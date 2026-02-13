"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getLocalStream, stopStream } from "../../../../_lib/media";
import { useRoom } from "../../../../_lib/room-context";
import { useSocket } from "../../../../_lib/socket-context";
import { fetchIceServers, PeerManager } from "../../../../_lib/webrtc";

type ConnectionState =
  | "idle"
  | "acquiring-media"
  | "connecting"
  | "connected"
  | "failed";

/** Max ICE restart attempts before declaring permanent failure. */
const MAX_ICE_RESTARTS = 2;

/**
 * How long to wait in "disconnected" state before attempting ICE restart.
 * Brief disconnections (e.g. network switch) often self-heal.
 */
const DISCONNECTED_TIMEOUT_MS = 8_000;

export function useWebRTC() {
  const { socket, sessionId } = useSocket();
  const { room } = useRoom();

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  const peerRef = useRef<PeerManager | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const iceServersRef = useRef<RTCIceServer[] | null>(null);

  // Refs for values used inside event callbacks (avoids stale closures)
  const roomCodeRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  // Track the remote peer so we can re-signal after ICE restart
  const targetSessionIdRef = useRef<string | null>(null);

  // ICE restart bookkeeping
  const iceRestartCountRef = useRef(0);
  const disconnectedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  roomCodeRef.current = room?.code ?? null;
  sessionIdRef.current = sessionId;

  // Pending offer received before media was ready
  const pendingOfferRef = useRef<{
    sessionId: string;
    sdp: RTCSessionDescriptionInit;
  } | null>(null);

  // ── Helpers ─────────────────────────────────────────────

  const clearDisconnectedTimer = useCallback(() => {
    if (disconnectedTimerRef.current) {
      clearTimeout(disconnectedTimerRef.current);
      disconnectedTimerRef.current = null;
    }
  }, []);

  /**
   * Attempt an ICE restart on the existing peer connection.
   * Creates a new offer with iceRestart: true and relays it.
   */
  const attemptIceRestart = useCallback(() => {
    const peer = peerRef.current;
    const targetId = targetSessionIdRef.current;
    const roomCode = roomCodeRef.current;

    if (!peer || !targetId || !roomCode) return;

    if (iceRestartCountRef.current >= MAX_ICE_RESTARTS) {
      console.warn("[webrtc] Max ICE restarts reached, giving up");
      setConnectionState("failed");
      setError("Connection lost — please rejoin the call");
      return;
    }

    iceRestartCountRef.current += 1;
    console.log(
      `[webrtc] ICE restart attempt ${iceRestartCountRef.current}/${MAX_ICE_RESTARTS}`
    );
    setConnectionState("connecting");
    setError(null);

    peer
      .restartIce()
      .then((sdp) => {
        socket.emit(
          "signal:offer",
          { roomCode, targetSessionId: targetId, sdp },
          (res: { ok: boolean; error?: string }) => {
            if (!res.ok) {
              console.warn("[webrtc] ICE restart offer relay failed:", res.error);
              setError("Failed to reach peer — they may have left");
              setConnectionState("failed");
            }
          }
        );
      })
      .catch((err) => {
        console.error("[webrtc] ICE restart failed:", err);
        setConnectionState("failed");
        setError("Failed to restart connection");
      });
  }, [socket]);

  // ── Create peer connection ────────────────────────────
  const createPeer = useCallback(
    (targetSessionId: string, shouldOffer: boolean) => {
      const stream = localStreamRef.current;
      const iceServers = iceServersRef.current;
      const roomCode = roomCodeRef.current;

      if (!stream || !iceServers || !roomCode) return;

      // Close any existing connection
      clearDisconnectedTimer();
      if (peerRef.current) {
        peerRef.current.close();
        peerRef.current = null;
      }

      // Reset restart counter for new peer connection
      iceRestartCountRef.current = 0;
      targetSessionIdRef.current = targetSessionId;

      const peer = new PeerManager(iceServers);
      peerRef.current = peer;
      peer.addLocalStream(stream);

      // Remote tracks → aggregate into a single MediaStream
      const remoteMediaStream = new MediaStream();

      peer.onRemoteTrack = (track) => {
        remoteMediaStream.addTrack(track);
        // New reference forces React state update
        setRemoteStream(new MediaStream(remoteMediaStream.getTracks()));
      };

      // ICE candidates → relay to peer via signaling server
      peer.onIceCandidate = (candidate) => {
        const code = roomCodeRef.current;
        if (!code) return;
        socket.emit(
          "signal:ice-candidate",
          { roomCode: code, targetSessionId, candidate: candidate.toJSON() },
          () => {}
        );
      };

      peer.onConnectionStateChange = (state) => {
        console.log("[webrtc] Connection state:", state);

        // Clear any pending disconnected timer on every state change
        clearDisconnectedTimer();

        switch (state) {
          case "connected":
            // Reset restart counter on successful connection
            iceRestartCountRef.current = 0;
            setConnectionState("connected");
            setError(null);
            break;

          case "disconnected":
            // Temporary network interruption — wait before escalating.
            // Many brief disconnects self-heal within a few seconds.
            setConnectionState("connecting");
            disconnectedTimerRef.current = setTimeout(() => {
              // Still disconnected after timeout — attempt ICE restart
              if (peerRef.current?.connectionState === "disconnected") {
                attemptIceRestart();
              }
            }, DISCONNECTED_TIMEOUT_MS);
            break;

          case "failed":
            // ICE or DTLS failure — attempt restart before giving up
            attemptIceRestart();
            break;

          case "closed":
            // Peer connection was closed (either by us or remotely)
            break;
        }
      };

      setConnectionState("connecting");
      setError(null);

      if (shouldOffer) {
        peer
          .createOffer()
          .then((sdp) => {
            socket.emit(
              "signal:offer",
              { roomCode, targetSessionId, sdp },
              (res: { ok: boolean; error?: string }) => {
                if (!res.ok) {
                  console.warn("[webrtc] Offer relay failed:", res.error);
                  setError("Failed to reach peer — they may have left");
                  setConnectionState("failed");
                }
              }
            );
          })
          .catch((err) => {
            console.error("[webrtc] Failed to create offer:", err);
            setError("Failed to create offer");
            setConnectionState("failed");
          });
      }
    },
    [socket, clearDisconnectedTimer, attemptIceRestart]
  );

  // ── Initialize media + ICE on mount ───────────────────
  useEffect(() => {
    let cancelled = false;

    async function init() {
      setConnectionState("acquiring-media");
      setError(null);

      try {
        const [stream, iceServers] = await Promise.all([
          getLocalStream(),
          fetchIceServers(),
        ]);

        if (cancelled) {
          stopStream(stream);
          return;
        }

        localStreamRef.current = stream;
        iceServersRef.current = iceServers;
        setLocalStream(stream);

        // Check for an offer that arrived while we were acquiring media
        const pending = pendingOfferRef.current;
        if (pending) {
          pendingOfferRef.current = null;
          createPeer(pending.sessionId, false);
          const peer = peerRef.current;
          if (peer) {
            const answer = await peer.handleOffer(pending.sdp);
            const roomCode = roomCodeRef.current;
            if (roomCode) {
              socket.emit(
                "signal:answer",
                { roomCode, targetSessionId: pending.sessionId, sdp: answer },
                (res: { ok: boolean; error?: string }) => {
                  if (!res.ok) {
                    console.warn("[webrtc] Answer relay failed:", res.error);
                    setError("Failed to reach peer");
                    setConnectionState("failed");
                  }
                }
              );
            }
          }
          return;
        }

        // If a peer is already in the room, initiate connection.
        // The peer with the higher sessionId sends the offer (deterministic tie-breaker).
        const myId = sessionIdRef.current;
        const onlinePeer = room?.participants.find((p) => p.online);
        if (myId && onlinePeer) {
          createPeer(onlinePeer.sessionId, myId > onlinePeer.sessionId);
        } else {
          setConnectionState("idle");
        }
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : "Failed to initialize";
        setError(message);
        setConnectionState("failed");
      }
    }

    init();

    return () => {
      cancelled = true;
      clearDisconnectedTimer();
      if (peerRef.current) {
        peerRef.current.close();
        peerRef.current = null;
      }
      if (localStreamRef.current) {
        stopStream(localStreamRef.current);
        localStreamRef.current = null;
      }
      targetSessionIdRef.current = null;
      setRemoteStream(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Socket signaling events ───────────────────────────
  useEffect(() => {
    function onOffer(data: {
      sessionId: string;
      sdp: RTCSessionDescriptionInit;
    }) {
      // If media isn't ready yet, queue the offer for later
      if (!localStreamRef.current || !iceServersRef.current) {
        pendingOfferRef.current = data;
        return;
      }

      // If we already have a peer connection to this sender, this is
      // likely an ICE restart offer — handle it on the existing connection.
      if (
        peerRef.current &&
        targetSessionIdRef.current === data.sessionId
      ) {
        const peer = peerRef.current;
        peer
          .handleOffer(data.sdp)
          .then((answer) => {
            const roomCode = roomCodeRef.current;
            if (!roomCode) return;
            socket.emit(
              "signal:answer",
              { roomCode, targetSessionId: data.sessionId, sdp: answer },
              (res: { ok: boolean; error?: string }) => {
                if (!res.ok) {
                  console.warn("[webrtc] Answer relay failed:", res.error);
                  setError("Failed to reach peer");
                  setConnectionState("failed");
                }
              }
            );
          })
          .catch((err) => {
            console.error("[webrtc] Failed to handle re-offer:", err);
            setError("Failed to renegotiate connection");
            setConnectionState("failed");
          });
        return;
      }

      // New peer connection — we are the answerer
      createPeer(data.sessionId, false);

      const peer = peerRef.current;
      if (!peer) return;

      peer
        .handleOffer(data.sdp)
        .then((answer) => {
          const roomCode = roomCodeRef.current;
          if (!roomCode) return;
          socket.emit(
            "signal:answer",
            { roomCode, targetSessionId: data.sessionId, sdp: answer },
            (res: { ok: boolean; error?: string }) => {
              if (!res.ok) {
                console.warn("[webrtc] Answer relay failed:", res.error);
                setError("Failed to reach peer");
                setConnectionState("failed");
              }
            }
          );
        })
        .catch((err) => {
          console.error("[webrtc] Failed to handle offer:", err);
          setError("Failed to establish connection");
          setConnectionState("failed");
        });
    }

    function onAnswer(data: {
      sessionId: string;
      sdp: RTCSessionDescriptionInit;
    }) {
      peerRef.current?.handleAnswer(data.sdp).catch((err) => {
        console.error("[webrtc] Failed to handle answer:", err);
        setError("Failed to complete connection handshake");
        setConnectionState("failed");
      });
    }

    function onIceCandidate(data: {
      sessionId: string;
      candidate: RTCIceCandidateInit;
    }) {
      peerRef.current?.addIceCandidate(data.candidate);
    }

    socket.on("signal:offer", onOffer);
    socket.on("signal:answer", onAnswer);
    socket.on("signal:ice-candidate", onIceCandidate);

    return () => {
      socket.off("signal:offer", onOffer);
      socket.off("signal:answer", onAnswer);
      socket.off("signal:ice-candidate", onIceCandidate);
    };
  }, [socket, createPeer]);

  // ── Room membership events ────────────────────────────
  useEffect(() => {
    function onPeerJoined(data: { sessionId: string }) {
      const myId = sessionIdRef.current;
      if (!myId || !localStreamRef.current || !iceServersRef.current) return;
      createPeer(data.sessionId, myId > data.sessionId);
    }

    function onPeerLeft() {
      clearDisconnectedTimer();
      if (peerRef.current) {
        peerRef.current.close();
        peerRef.current = null;
      }
      targetSessionIdRef.current = null;
      setRemoteStream(null);
      setConnectionState("idle");
      setError(null);
    }

    function onPeerDisconnected() {
      // Peer's socket dropped but their session is in grace period.
      // The WebRTC connection may still be alive (UDP can survive
      // a brief socket outage). Keep the peer connection open and
      // let onConnectionStateChange handle it if the media path dies.
      // Just update UI to show the peer might be reconnecting.
      if (
        peerRef.current &&
        peerRef.current.connectionState !== "connected"
      ) {
        setConnectionState("connecting");
      }
    }

    function onPeerReconnected(data: { sessionId: string }) {
      const myId = sessionIdRef.current;
      if (!myId || !localStreamRef.current || !iceServersRef.current) return;

      // If the existing peer connection is still healthy, no need
      // to recreate — the media path survived the socket blip.
      if (
        peerRef.current &&
        targetSessionIdRef.current === data.sessionId &&
        peerRef.current.connectionState === "connected"
      ) {
        return;
      }

      // Otherwise, build a fresh connection
      createPeer(data.sessionId, myId > data.sessionId);
    }

    socket.on("room:peer-joined", onPeerJoined);
    socket.on("room:peer-left", onPeerLeft);
    socket.on("room:peer-disconnected", onPeerDisconnected);
    socket.on("room:peer-reconnected", onPeerReconnected);

    return () => {
      socket.off("room:peer-joined", onPeerJoined);
      socket.off("room:peer-left", onPeerLeft);
      socket.off("room:peer-disconnected", onPeerDisconnected);
      socket.off("room:peer-reconnected", onPeerReconnected);
    };
  }, [socket, createPeer, clearDisconnectedTimer]);

  const toggleAudio = useCallback(() => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setIsAudioMuted(!track.enabled);
    }
  }, []);

  const toggleVideo = useCallback(() => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setIsVideoOff(!track.enabled);
    }
  }, []);

  return {
    localStream,
    remoteStream,
    connectionState,
    error,
    isAudioMuted,
    isVideoOff,
    toggleAudio,
    toggleVideo,
  };
}
