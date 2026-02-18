FROM coturn/coturn:latest

USER root
RUN apt-get update && apt-get install -y --no-install-recommends gettext-base && rm -rf /var/lib/apt/lists/*

COPY turnserver.conf /etc/turnserver.conf.template

# envsubst substitutes env vars into the config template at runtime.
ENTRYPOINT [ "sh", "-c", \
  "envsubst < /etc/turnserver.conf.template > /tmp/turnserver.conf && exec turnserver -c /tmp/turnserver.conf" ]

EXPOSE 3478/tcp 3478/udp 5349/tcp 5349/udp 49152-65535/udp
