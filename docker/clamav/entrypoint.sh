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

exec clamd --foreground=true --config-file=/etc/clamav/clamd.conf
