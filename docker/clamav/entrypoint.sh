#!/bin/sh
set -eu

mkdir -p /var/lib/clamav /run/clamav /var/log/clamav
chown -R clamav:clamav /var/lib/clamav /run/clamav /var/log/clamav

if ! ls /var/lib/clamav/*.cvd /var/lib/clamav/*.cld >/dev/null 2>&1; then
  echo "[clamav] no local virus database found, running freshclam..."
  if ! freshclam --stdout; then
    echo "[clamav] freshclam failed, clamd may not start without an existing database."
  fi
fi

cat >/etc/clamav/clamd.conf <<'EOF'
LogFile /var/log/clamav/clamd.log
LogTime yes
Foreground yes
TCPSocket 3310
TCPAddr 0.0.0.0
LocalSocket /run/clamav/clamd.sock
FixStaleSocket true
User clamav
DatabaseDirectory /var/lib/clamav
ReadTimeout 180
CommandReadTimeout 180
MaxFileSize 2048M
MaxScanSize 2048M
EOF

exec clamd --foreground=true --config-file=/etc/clamav/clamd.conf
