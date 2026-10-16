# Pinned, so a rebuild can't pick up a new coturn release (and its config
# changes) unannounced. To upgrade, change the tag and the digest together;
# the digest is the multi-arch one from
# `docker buildx imagetools inspect coturn/coturn:<tag>`.
FROM coturn/coturn:4.18.0@sha256:bbefd3e1fdfdc0d58770fe01b581fd8b00d9f3a5580d00acb77cf719a6bc78e3

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
