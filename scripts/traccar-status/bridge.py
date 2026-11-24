#!/usr/bin/env python3
"""Read-only JT808 log metadata bridge. Standard library, Python 3.9+."""
import argparse
import datetime as dt
import getpass
import hashlib
import hmac
import json
import logging
import os
import re
import secrets
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import OrderedDict
from pathlib import Path
from zoneinfo import ZoneInfo

LINE = re.compile(r'^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\s+INFO: \[([^:\]]+): jt808 < [^\]]+\] ([0-9a-fA-F]+)\s*$')
ID = re.compile(r'^\d{12}(\d{8})?$')


def decode(frame, identifier, received_at):
    """One frame without 7e delimiters. Reject malformed/escaped/checksum failures."""
    b = bytearray()
    i = 0
    while i < len(frame):
        v = frame[i]
        if v == 0x7d:
            i += 1
            if i == len(frame) or frame[i] not in (1, 2):
                return None
            v = 0x7d if frame[i] == 1 else 0x7e
        b.append(v)
        i += 1
    if len(b) < 13:
        return None
    checksum = 0
    for value in b:
        checksum ^= value
    if checksum:
        return None
    kind, prop = int.from_bytes(b[:2], 'big'), int.from_bytes(b[2:4], 'big')
    if prop & 0x3c00:  # encryption or subpackets are not used by these reports
        return None
    versioned = bool(prop & 0x4000)
    offset, size = (5, 10) if versioned else (4, 6)
    header = offset + size + 2
    if len(b) != header + (prop & 1023) + 1 or b[offset:offset+size].hex() != identifier:
        return None
    body = b[header:-1]
    if kind == 0x0210 and len(body) == 7 and body[0] <= 100:
        return {'kind': 'sleep_report', 'receivedAt': received_at, 'battery': body[0]}
    if kind == 0x0002 and not body:
        return {'kind': 'heartbeat', 'receivedAt': received_at}
    if kind not in (0x0200, 0x0201):
        return None
    if kind == 0x0201:
        body = body[2:]  # response serial number
    if len(body) < 28:
        return None
    event = {'kind': 'query_report' if kind == 0x0201 else 'position_report', 'receivedAt': received_at}
    at = 28
    while at < len(body):
        if at + 2 > len(body):
            return None
        tag, length = body[at:at+2]
        at += 2
        if at + length > len(body):
            return None
        value = body[at:at+length]
        at += length
        if tag == 0xe4 and length == 2:
            if value[0] in (0, 1):
                event['charging'] = value[0] == 0
            if value[1] <= 100:
                event['battery'] = value[1]
    return event


class Reader:
    def __init__(self, identifier, timezone='Europe/Copenhagen'):
        self.identifier = identifier
        self.zone = ZoneInfo(timezone)
        self.connections = OrderedDict()

    def line(self, line):
        match = LINE.match(line.rstrip())
        if not match:
            disconnected = re.search(r'\[([^\]]+)\] disconnected', line)
            if disconnected:
                self.connections.pop(disconnected[1], None)
            return []
        stamp, connection, raw = match.groups()
        try:
            local = dt.datetime.strptime(stamp, '%Y-%m-%d %H:%M:%S')
            first, second = local.replace(tzinfo=self.zone, fold=0), local.replace(tzinfo=self.zone, fold=1)
            # A log without an offset cannot distinguish the repeated autumn hour.
            # Leave status unknown rather than turn an old report into fresh evidence.
            if first.utcoffset() != second.utcoffset():
                return []
            at = int(first.timestamp()*1000)
            data = bytes.fromhex(raw)
        except ValueError:
            return []
        # A TCP chunk may contain multiple frames or only part of a frame.
        buffer = self.connections.pop(connection, None)
        result = []
        for byte in data:
            if byte == 0x7e:
                if buffer:
                    event = decode(buffer, self.identifier, at)
                    if event:
                        result.append(event)
                buffer = bytearray()
            elif buffer is not None:
                buffer.append(byte)
                if len(buffer) > 32768:
                    buffer = None
        self.connections[connection] = buffer
        while len(self.connections) > 32:
            self.connections.popitem(last=False)
        return result


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def valid_https(value, origin=False):
    url = urllib.parse.urlsplit(value)
    if url.scheme != 'https' or not url.hostname or url.username or url.password or url.query or url.fragment:
        raise ValueError('Brug en HTTPS-adresse uden login, query eller fragment.')
    if origin and url.path not in ('', '/'):
        raise ValueError('Traccar-adressen skal være uden sti.')
    return value.rstrip('/')


def send(config, events):
    data = {'identifier': config['identifier'], 'serverUrl': config['serverUrl'], 'sentAt': int(time.time()*1000), 'events': events}
    raw = json.dumps(data, separators=(',', ':')).encode('utf-8')
    signature = hmac.new(config['key'].encode(), raw, hashlib.sha256).hexdigest()
    request = urllib.request.Request(config['endpoint'], data=raw, method='POST', headers={'Content-Type': 'application/json', 'X-Pejlo-Signature': signature})
    with urllib.request.build_opener(NoRedirect).open(request, timeout=15) as response:
        if response.status != 200 or json.loads(response.read(4096)).get('ok') is not True:
            raise ValueError('Statusmodtageren afviste svaret.')


def configure(path):
    identifier = input('Tracker-ID [080608317309]: ').strip() or '080608317309'
    if not ID.fullmatch(identifier):
        raise ValueError('Tracker-ID skal have 12 eller 20 cifre som i råloggen.')
    app = valid_https(input('Pejlo-appens HTTPS-adresse: ').strip(), origin=True)
    server = valid_https(input('Aktiv Traccar HTTPS-adresse [https://pejlo.duckdns.org]: ').strip() or 'https://pejlo.duckdns.org', origin=True)
    keys = json.loads(getpass.getpass('Indsæt JSON-værdien fra PEJLO_STATUS_KEYS (skjult): '))
    key = keys.get(identifier)
    if not isinstance(key, str) or not re.fullmatch('[0-9a-f]{64}', key):
        raise ValueError('Adgangsnøglen passer ikke til tracker-ID.')
    config = {'identifier': identifier, 'key': key, 'endpoint': app+'/api/tracker/report-state', 'serverUrl': server, 'log': '/opt/traccar/logs/tracker-server.log', 'timezone': 'Europe/Copenhagen'}
    # Retain original received times; a service restart must never freshen old data.
    with open(config['log'], encoding='utf-8', errors='replace') as log:
        log.seek(max(0, os.fstat(log.fileno()).st_size-262144))
        reader = Reader(identifier)
        recent = {}
        now = int(time.time()*1000)
        for line in log:
            for event in reader.line(line):
                if now-86400000 <= event['receivedAt'] <= now+60000:
                    recent[event['kind']] = event
    if not recent:
        raise ValueError('Ingen gyldige JT808-rapporter i loggens sidste 256 KB. Vent på en ny rapport og prøv igen.')
    send(config, list(recent.values()))  # verifies key, endpoint and server before enabling
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, 'w') as output:
        json.dump(config, output)
    os.chmod(path, 0o600)
    print('Forbindelsen er testet. Konfigurationen er gemt uden at ændre trackeren.')


def follow(config):
    reader = Reader(config['identifier'], config.get('timezone', 'Europe/Copenhagen'))
    pending, log = {}, None
    backfill, next_send, last_line, retry = True, 0, '', 5
    while True:
        try:
            if log is None:
                log = open(config['log'], encoding='utf-8', errors='replace')
                if backfill:
                    log.seek(max(0, os.fstat(log.fileno()).st_size-262144))
                    backfill = False
            # Preserve an incomplete newline and limit work per loop for a busy log.
            for _ in range(2000):
                line = log.readline()
                if not line:
                    break
                line = last_line+line
                if not line.endswith('\n'):
                    last_line = line[-131072:]
                    break
                last_line = ''
                for event in reader.line(line):
                    if event['receivedAt'] > pending.get(event['kind'], {}).get('receivedAt', 0):
                        pending[event['kind']] = event
            now = int(time.time()*1000)
            pending = {kind: event for kind, event in pending.items() if now-86400000 <= event['receivedAt'] <= now+60000}
            if pending and time.monotonic() >= next_send:
                try:
                    send(config, list(pending.values()))
                    logging.info('Status sendt (%d beskedtyper).', len(pending))
                    pending.clear()
                    retry = 5
                except (OSError, ValueError, urllib.error.URLError) as error:
                    # Never log request bodies, headers, credentials or raw tracker data.
                    logging.warning('Status kunne ikke sendes (HTTP %s); prøver igen.', getattr(error, 'code', 'ukendt'))
                    retry = min(300, retry*2)
                next_send = time.monotonic()+retry
            try:
                current, opened = os.stat(config['log']), os.fstat(log.fileno())
                if (current.st_dev, current.st_ino) != (opened.st_dev, opened.st_ino) or current.st_size < log.tell():
                    log.close()
                    log, last_line = None, ''
            except FileNotFoundError:
                pass  # rotation can briefly remove the pathname
        except OSError:
            logging.warning('Logfilen kunne ikke læses; prøver igen.')
            if log:
                log.close()
            log = None
        time.sleep(1)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--config', default='/etc/pejlo-status.json')
    parser.add_argument('--configure', action='store_true')
    parser.add_argument('--make-key', metavar='TRACKER_ID')
    args = parser.parse_args()
    if args.make_key:
        if not ID.fullmatch(args.make_key):
            parser.error('Tracker-ID skal have 12 eller 20 cifre.')
        print(json.dumps({args.make_key: secrets.token_hex(32)}))
    elif args.configure:
        configure(args.config)
    else:
        logging.basicConfig(level=logging.INFO, format='%(levelname)s %(message)s')
        config = json.loads(Path(args.config).read_text())
        valid_https(config['endpoint'])
        valid_https(config['serverUrl'], origin=True)
        if not ID.fullmatch(config['identifier']) or not re.fullmatch('[0-9a-f]{64}', config['key']):
            raise ValueError('Ugyldig statuskonfiguration.')
        follow(config)


if __name__ == '__main__':
    main()
