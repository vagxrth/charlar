#!/bin/sh
# Resolve the addresses coturn advertises, then hand off to turnserver.
#
# The relay address is baked into every ICE candidate coturn hands out, so a
# stale value does not fail loudly — signaling, chat and direct P2P keep
# working while every relayed call streams to an address that no longer
# belongs to this host. Cloud VMs reassign ephemeral external IPs on stop, so
# a hand-edited value in turn/.env goes stale the first time the VM restarts.
#
# Leaving TURN_EXTERNAL_IP / TURN_LISTENING_IP blank lets the container ask
# the platform on every start instead. An explicitly set value still wins,
# for hosts that sit behind a load balancer with a different public address.
set -eu

GCE_METADATA="http://169.254.169.254/computeMetadata/v1/instance/network-interfaces/0"

# Echoes the metadata value, or nothing at all when not running on GCE.
metadata() {
  curl -fsS -m 2 -H "Metadata-Flavor: Google" "$GCE_METADATA/$1" 2>/dev/null || true
}

if [ -z "${TURN_EXTERNAL_IP:-}" ]; then
  TURN_EXTERNAL_IP=$(metadata "access-configs/0/external-ip")
fi

if [ -z "${TURN_LISTENING_IP:-}" ]; then
  TURN_LISTENING_IP=$(metadata "ip")
fi

# Without these, envsubst would happily produce "external-ip=/10.128.0.2" and
# coturn would start and serve unreachable candidates. Refuse instead.
require() {
  if [ -z "$2" ]; then
    echo "turn-entrypoint: $1 is not set — refusing to start" >&2
    echo "turn-entrypoint: set it in infrastructure/turn/.env (the IPs auto-detect on GCE when left blank)" >&2
    exit 1
  fi
}

require TURN_EXTERNAL_IP "${TURN_EXTERNAL_IP:-}"
require TURN_LISTENING_IP "${TURN_LISTENING_IP:-}"
require TURN_SECRET "${TURN_SECRET:-}"
require TURN_REALM "${TURN_REALM:-}"

export TURN_EXTERNAL_IP TURN_LISTENING_IP

echo "turn-entrypoint: realm=$TURN_REALM external-ip=$TURN_EXTERNAL_IP/$TURN_LISTENING_IP"

envsubst < /etc/turnserver.conf.template > /tmp/turnserver.conf
exec turnserver -c /tmp/turnserver.conf
