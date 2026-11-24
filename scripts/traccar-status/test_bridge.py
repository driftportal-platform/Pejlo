import datetime as dt
import unittest
from unittest.mock import patch
import json
import hmac
import hashlib
import bridge
import io
from types import SimpleNamespace

IDENTIFIER = '080608317309'
SLEEP = '7e0210000708060831730902584f2611242134054e7e'
POSITION = '7e0200005e080608317309026200000000004c000d035efa1d007f1ab0000000000000261124214856300110310100e11c00ee00020036c50280680dad001fa4010fd750b400c41b03295b3cb1e402014fec1528bd89055c47bc28bd89055c10c328bd89054392abf50101807e'


def line(hex_value, connection='Ttest', stamp='2026-11-24 22:34:07'):
    return f'{stamp}  INFO: [{connection}: jt808 < 37.96.52.172] {hex_value}\n'


def frame(kind, body):
    b = kind.to_bytes(2, 'big')+len(body).to_bytes(2, 'big')+bytes.fromhex(IDENTIFIER)+b'\x00\x7e'+body
    checksum = 0
    for v in b:
        checksum ^= v
    b += bytes([checksum])
    return b'\x7e'+b.replace(b'\x7d', b'\x7d\x01').replace(b'\x7e', b'\x7d\x02')+b'\x7e'


class BridgeTest(unittest.TestCase):
    def test_real_sleep_uses_received_time_not_the_old_device_timezone(self):
        event = bridge.Reader(IDENTIFIER).line(line(SLEEP))[0]
        expected = int(dt.datetime(2026, 11, 24, 21, 34, 7, tzinfo=dt.timezone.utc).timestamp()*1000)
        self.assertEqual(event, {'kind': 'sleep_report', 'receivedAt': expected, 'battery': 79})

    def test_real_report_charge_and_battery(self):
        event = bridge.Reader(IDENTIFIER).line(line(POSITION))[0]
        self.assertEqual(event['kind'], 'position_report')
        self.assertEqual(event['battery'], 79)
        self.assertIs(event['charging'], False)

    def test_ambiguous_dst_hour_is_not_guessed(self):
        self.assertEqual(bridge.Reader(IDENTIFIER).line(line(SLEEP, stamp='2026-10-25 02:30:00')), [])

    def test_tcp_fragments_multiple_frames_and_connection_isolation(self):
        reader = bridge.Reader(IDENTIFIER)
        self.assertEqual(reader.line(line(SLEEP[:30])), [])
        self.assertEqual(reader.line(line(SLEEP[30:], 'Tother')), [])
        events = reader.line(line(SLEEP[30:]+POSITION))
        self.assertEqual([e['kind'] for e in events], ['sleep_report', 'position_report'])

    def test_unknown_device_corrupt_checksum_and_outgoing_messages_are_ignored(self):
        reader = bridge.Reader(IDENTIFIER)
        self.assertEqual(reader.line(line(SLEEP.replace('317309', '317308'))), [])
        self.assertEqual(reader.line(line(SLEEP.replace('4e7e', '4f7e'))), [])
        self.assertEqual(reader.line(line(SLEEP).replace('jt808 <', 'jt808 >')), [])
        self.assertEqual(reader.line(line('7e7d037e')), [])

    def test_escaped_checksum_and_header_are_restored(self):
        body = bytes([0x7e])+bytes.fromhex('261124213405')
        # A battery above 100 is rejected; escaping itself is handled correctly.
        self.assertEqual(bridge.Reader(IDENTIFIER).line(line(frame(0x210, body).hex())), [])
        events = bridge.Reader(IDENTIFIER).line(line(frame(0x210, b'\x4f'+body[1:]).hex()))
        self.assertEqual(events[0]['battery'], 79)

    def test_empty_heartbeat_has_no_sleep_flag(self):
        event = bridge.Reader(IDENTIFIER).line(line(frame(2, b'').hex()))[0]
        self.assertEqual(event['kind'], 'heartbeat')
        self.assertNotIn('battery', event)

    def test_short_0210_does_not_confuse_a_location_batch_with_sleep(self):
        self.assertEqual(bridge.Reader(IDENTIFIER).line(line(frame(0x210, b'\x01'*10).hex())), [])

    def test_http_payload_is_signed_and_retries_keep_original_report_time(self):
        config = {'identifier': IDENTIFIER, 'serverUrl': 'https://traccar.example.com', 'key': 'a'*64, 'endpoint': 'https://pejlo.example.com/api/tracker/report-state'}
        event = {'kind': 'sleep_report', 'receivedAt': 123456, 'battery': 79}
        captured = []
        class Response:
            status = 200
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def read(self, size): return b'{"ok":true}'
        class Opener:
            def open(self, request, timeout):
                captured.append(request)
                return Response()
        with patch('bridge.urllib.request.build_opener', return_value=Opener()), patch('bridge.time.time', side_effect=[1000, 2000]):
            bridge.send(config, [event])
            bridge.send(config, [event])
        for req in captured:
            payload = json.loads(req.data)
            self.assertEqual(payload['events'][0]['receivedAt'], 123456)
            self.assertEqual(req.get_header('X-pejlo-signature'), hmac.new(config['key'].encode(), req.data, hashlib.sha256).hexdigest())
        self.assertNotEqual(captured[0].data, captured[1].data)

    def test_rotation_reopens_the_new_log_without_refreshing_the_old_sleep_time(self):
        stamp = dt.datetime.now(bridge.ZoneInfo('Europe/Copenhagen')).strftime('%Y-%m-%d %H:%M:%S')
        texts = [line(SLEEP, stamp=stamp), line(POSITION, stamp=stamp)]
        class Log(io.StringIO):
            def __init__(self, value, number):
                super().__init__(value)
                self.number = number
            def fileno(self): return self.number
        logs = [Log(value, i+1) for i, value in enumerate(texts)]
        stat = lambda i: SimpleNamespace(st_dev=1, st_ino=i, st_size=len(texts[i-1]))
        captured = []
        config = {'identifier': IDENTIFIER, 'log': '/test.log'}
        with patch('bridge.open', side_effect=logs), patch('bridge.os.fstat', side_effect=stat), patch('bridge.os.stat', return_value=stat(2)), patch('bridge.time.sleep', side_effect=[None, StopIteration]), patch('bridge.time.monotonic', side_effect=[0, 0, 10, 10]), patch('bridge.send', side_effect=lambda c, events: captured.extend(events)):
            with self.assertRaises(StopIteration):
                bridge.follow(config)
        self.assertEqual([e['kind'] for e in captured], ['sleep_report', 'position_report'])
        self.assertEqual(captured[0]['receivedAt'], captured[1]['receivedAt'])


if __name__ == '__main__':
    unittest.main()
