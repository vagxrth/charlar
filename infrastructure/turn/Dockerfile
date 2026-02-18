FROM coturn/coturn:latest

COPY turnserver.conf /etc/turnserver.conf.template

# envsubst ships in the coturn image (via gettext-base).
# At runtime: substitute env vars into the template, then exec turnserver.
ENTRYPOINT [ "sh", "-c", \
  "envsubst < /etc/turnserver.conf.template > /tmp/turnserver.conf && exec turnserver -c /tmp/turnserver.conf" ]

EXPOSE 3478/tcp 3478/udp 5349/tcp 5349/udp 49152-65535/udp
