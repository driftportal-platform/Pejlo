#!/usr/bin/env bash
set -euo pipefail
if [ "${EUID}" -ne 0 ]; then
  echo 'Kør installationen med sudo bash install.sh.' >&2
  exit 1
fi
bridge_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
python3 -c 'import sys, zoneinfo; assert sys.version_info >= (3,9); zoneinfo.ZoneInfo("Europe/Copenhagen")'
if ! id pejlo-status >/dev/null 2>&1; then
  useradd --system --user-group --home-dir /nonexistent --shell /usr/sbin/nologin pejlo-status
fi
install -d -m 0755 /opt/pejlo-status
install -m 0755 "${bridge_dir}/bridge.py" /opt/pejlo-status/bridge.py
python3 /opt/pejlo-status/bridge.py --configure
chown root:pejlo-status /etc/pejlo-status.json
chmod 0640 /etc/pejlo-status.json
if ! runuser -u pejlo-status -- test -r /opt/traccar/logs/tracker-server.log; then
  echo 'Statusbrugeren kan ikke læse Traccar-loggen. Tjenesten er ikke startet. Kontrollér læserettighederne til logmappen.' >&2
  exit 1
fi
install -m 0644 "${bridge_dir}/pejlo-status.service" /etc/systemd/system/pejlo-status.service
systemctl daemon-reload
systemctl enable pejlo-status.service
systemctl restart pejlo-status.service
systemctl --no-pager --full status pejlo-status.service
