FROM coturn/coturn:latest

USER root
# gettext-base provides envsubst; curl queries the cloud metadata server.
RUN apt-get update \
  && apt-get install -y --no-install-recommends gettext-base curl \
  && rm -rf /var/lib/apt/lists/*

COPY turnserver.conf /etc/turnserver.conf.template
COPY docker-entrypoint.sh /usr/local/bin/turn-entrypoint
RUN chmod +x /usr/local/bin/turn-entrypoint

# Resolves the advertised addresses, substitutes the config, execs turnserver.
ENTRYPOINT ["/usr/local/bin/turn-entrypoint"]

EXPOSE 3478/tcp 3478/udp 5349/tcp 5349/udp 49152-65535/udp
