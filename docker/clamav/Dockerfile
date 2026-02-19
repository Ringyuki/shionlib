FROM debian:bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    clamav \
    clamav-daemon \
    clamav-freshclam \
    netcat-openbsd \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY docker/clamav/entrypoint.sh /usr/local/bin/clamav-entrypoint

RUN chmod +x /usr/local/bin/clamav-entrypoint \
  && mkdir -p /var/lib/clamav /run/clamav /var/log/clamav \
  && chown -R clamav:clamav /var/lib/clamav /run/clamav /var/log/clamav

EXPOSE 3310

ENTRYPOINT ["/usr/local/bin/clamav-entrypoint"]
