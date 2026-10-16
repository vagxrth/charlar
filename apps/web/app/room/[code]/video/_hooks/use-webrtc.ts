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

/**
 * The lower-id peer doesn't restart ICE itself; it waits for the offerer's
 * restart. If none arrives in this window, it gives up with an error.
 */
const RESTART_WAIT_MS = 20_000;

/**
 * A connection still in "new" (offer sent, no answer yet) counts as live
 * for this long, so near-simultaneous triggers don't rebuild it. Past that,
 * its offer was probably lost and a later trigger may rebuild it.
 */
const STALE_NEW_PEER_MS = 10_000;

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

  /**
   * Whether the *remote* participant has muted their mic or stopped
   * their camera. We learn this from a small "media:state" relay over
   * the signaling socket — `track.enabled = false` does not actually
   * trigger remote-side mute events in WebRTC (the source still
   * streams silence/black), so we have to tell each other explicitly.
   */
  const [remoteAudioMuted, setRemoteAudioMuted] = useState(false);
  const [remoteVideoOff, setRemoteVideoOff] = useState(false);

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
  // The lower-id side's "give up if no restart offer arrives" timer.
  const giveUpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // When the current peer connection was created (see STALE_NEW_PEER_MS).
  const peerCreatedAtRef = useRef(0);

  // Set once camera/mic and ICE config are ready, so connection attempts
  // triggered by room changes know they can proceed.
  const mediaReadyRef = useRef(false);

  // Current participants, read inside callbacks without re-creating them.
  const participantsRef = useRef(room?.participants ?? []);

  roomCodeRef.current = room?.code ?? null;
  sessionIdRef.current = sessionId;
  participantsRef.current = room?.participants ?? [];

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

  const clearGiveUpTimer = useCallback(() => {
    if (giveUpTimerRef.current) {
      clearTimeout(giveUpTimerRef.current);
      giveUpTimerRef.current = null;
    }
  }, []);

  /** True when we hold a connection to this peer that is up or coming up. */
  const hasLiveConnectionTo = useCallback((peerId: string): boolean => {
    const peer = peerRef.current;
    if (peer === null || targetSessionIdRef.current !== peerId) return false;

    const state = peer.connectionState;
    if (state === "connected" || state === "connecting") return true;
    // A fresh "new" connection is still waiting on its answer; a stale one
    // lost its offer, so let the caller rebuild it.
    return (
      state === "new" &&
      Date.now() - peerCreatedAtRef.current < STALE_NEW_PEER_MS
    );
  }, []);

  /**
   * Attempt an ICE restart on the existing peer connection.
   * Creates a new offer with iceRestart: true and relays it.
   */
  const attemptIceRestart = useCallback(() => {
    const peer = peerRef.current;
    const targetId = targetSessionIdRef.current;
    const roomCode = roomCodeRef.current;
    const myId = sessionIdRef.current;

    if (!peer || !targetId || !roomCode || !myId) return;

    // Only the higher-id peer (the original offerer) restarts ICE, so the two
    // sides don't send colliding offers. The lower-id side waits for that
    // restart offer and only gives up if it never comes.
    if (myId < targetId) {
      setConnectionState("connecting");
      clearGiveUpTimer();
      giveUpTimerRef.current = setTimeout(() => {
        if (peerRef.current && peerRef.current.connectionState !== "connected") {
          setConnectionState("failed");
          setError("Connection lost — please rejoin the call");
        }
      }, RESTART_WAIT_MS);
      return;
    }

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
  }, [socket, clearGiveUpTimer]);

  // ── Create peer connection ────────────────────────────
  const createPeer = useCallback(
    (targetSessionId: string, shouldOffer: boolean) => {
      const stream = localStreamRef.current;
      const iceServers = iceServersRef.current;
      const roomCode = roomCodeRef.current;

      if (!stream || !iceServers || !roomCode) return;

      // Close any existing connection
      clearDisconnectedTimer();
      clearGiveUpTimer();
      if (peerRef.current) {
        peerRef.current.close();
        peerRef.current = null;
      }

      // Reset restart counter for new peer connection
      iceRestartCountRef.current = 0;
      targetSessionIdRef.current = targetSessionId;

      const peer = new PeerManager(iceServers);
      peerRef.current = peer;
      peerCreatedAtRef.current = Date.now();
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
            clearGiveUpTimer();
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
        // If the offer never gets out, drop this connection so a later
        // reconnect builds a fresh one instead of waiting on it forever.
        const abandon = () => {
          if (peerRef.current === peer) {
            peer.close();
            peerRef.current = null;
          }
        };

        peer
          .createOffer()
          .then((sdp) => {
            socket.emit(
              "signal:offer",
              { roomCode, targetSessionId, sdp },
              (res: { ok: boolean; error?: string }) => {
                if (!res.ok) {
                  console.warn("[webrtc] Offer relay failed:", res.error);
                  abandon();
                  setError("Failed to reach peer — they may have left");
                  setConnectionState("failed");
                }
              }
            );
          })
          .catch((err) => {
            console.error("[webrtc] Failed to create offer:", err);
            abandon();
            setError("Failed to create offer");
            setConnectionState("failed");
          });
      }
    },
    [socket, clearDisconnectedTimer, clearGiveUpTimer, attemptIceRestart]
  );

  /**
   * Start, or ask the peer to start, a connection — used on join, on the
   * peer reconnecting, and when the room is restored after our own reload.
   * The higher-id peer offers; the lower-id peer does nothing and waits for
   * that offer (which keeps roles glare-free). No-ops if a connection to this
   * peer is already up or coming up.
   */
  const connectTo = useCallback(
    (peerId: string) => {
      const myId = sessionIdRef.current;
      if (!myId || !mediaReadyRef.current || !roomCodeRef.current) return;
      if (peerId === myId) return;
      if (hasLiveConnectionTo(peerId)) return;
      if (myId > peerId) {
        createPeer(peerId, true);
      } else {
        // We're the answerer; the higher-id peer will send the offer. Show
        // "connecting" so the UI isn't stuck on "waiting" meanwhile.
        setConnectionState((s) => (s === "connected" ? s : "connecting"));
      }
    },
    [createPeer, hasLiveConnectionTo]
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
        mediaReadyRef.current = true;
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

        // If a peer is already here, start connecting. `connectTo` excludes
        // our own session and picks who offers.
        const myId = sessionIdRef.current;
        const onlinePeer = participantsRef.current.find(
          (p) => p.online && p.sessionId !== myId
        );
        if (onlinePeer) {
          connectTo(onlinePeer.sessionId);
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
      mediaReadyRef.current = false;
      clearDisconnectedTimer();
      clearGiveUpTimer();
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
      connectTo(data.sessionId);
    }

    function onPeerLeft(data: { sessionId: string }) {
      // Only the peer we're connected to (or one whose offer is still
      // queued) can end this call.
      if (pendingOfferRef.current?.sessionId === data.sessionId) {
        pendingOfferRef.current = null;
      }
      if (data.sessionId !== targetSessionIdRef.current) return;

      clearDisconnectedTimer();
      clearGiveUpTimer();
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
      // The peer's socket came back (often after their reload). If the media
      // path survived, connectTo no-ops; otherwise it rebuilds, with the
      // higher-id side offering.
      connectTo(data.sessionId);
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
  }, [socket, connectTo, clearDisconnectedTimer, clearGiveUpTimer]);

  // ── Re-initiate after our own reload ──────────────────
  // The mount effect reads the room from the first render, which is empty
  // right after a reload. Once media is ready and the room is restored,
  // connect to whoever is already here; re-runs when participants change.
  useEffect(() => {
    if (!mediaReadyRef.current) return;
    const myId = sessionIdRef.current;
    const onlinePeer = room?.participants.find(
      (p) => p.online && p.sessionId !== myId
    );
    if (onlinePeer) connectTo(onlinePeer.sessionId);
  }, [room?.code, room?.participants, connectTo]);

  /** Broadcast our current mute/camera state to other participants. */
  const broadcastMediaState = useCallback(
    (audioMuted: boolean, videoOff: boolean) => {
      const roomCode = roomCodeRef.current;
      if (!roomCode) return;
      socket.emit(
        "media:state",
        { roomCode, audioMuted, videoOff },
        () => {}
      );
    },
    [socket]
  );

  const toggleAudio = useCallback(() => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      const muted = !track.enabled;
      setIsAudioMuted(muted);
      broadcastMediaState(muted, isVideoOff);
    }
  }, [broadcastMediaState, isVideoOff]);

  const toggleVideo = useCallback(() => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      const off = !track.enabled;
      setIsVideoOff(off);
      broadcastMediaState(isAudioMuted, off);
    }
  }, [broadcastMediaState, isAudioMuted]);

  // ── Remote media-state listener ───────────────────────
  useEffect(() => {
    function onMediaState(data: {
      sessionId: string;
      audioMuted: boolean;
      videoOff: boolean;
    }) {
      // Only honor updates from our current peer
      if (targetSessionIdRef.current && data.sessionId !== targetSessionIdRef.current) {
        return;
      }
      setRemoteAudioMuted(Boolean(data.audioMuted));
      setRemoteVideoOff(Boolean(data.videoOff));
    }

    function onPeerLeft() {
      setRemoteAudioMuted(false);
      setRemoteVideoOff(false);
    }

    socket.on("media:state", onMediaState);
    socket.on("room:peer-left", onPeerLeft);

    return () => {
      socket.off("media:state", onMediaState);
      socket.off("room:peer-left", onPeerLeft);
    };
  }, [socket]);

  // When the peer connection establishes, push our current state so
  // the freshly-connected peer can render correct badges immediately.
  useEffect(() => {
    if (connectionState === "connected") {
      broadcastMediaState(isAudioMuted, isVideoOff);
    }
    // We deliberately don't depend on isAudioMuted/isVideoOff —
    // the toggle functions already broadcast their own changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionState, broadcastMediaState]);

  return {
    localStream,
    remoteStream,
    connectionState,
    error,
    isAudioMuted,
    isVideoOff,
    remoteAudioMuted,
    remoteVideoOff,
    toggleAudio,
    toggleVideo,
  };
}
