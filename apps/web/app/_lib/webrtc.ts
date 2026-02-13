/**
 * Modular WebRTC helper — manages RTCPeerConnection lifecycle,
 * ICE candidate queuing, and SDP negotiation.
 */

import { env } from "./env";

// ── ICE config fetcher ──────────────────────────────────

export async function fetchIceServers(): Promise<RTCIceServer[]> {
  try {
    const res = await fetch(`${env.serverUrl}/api/ice-config`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { iceServers?: RTCIceServer[] };
    return data.iceServers ?? [];
  } catch (err) {
    console.warn("[webrtc] Failed to fetch ICE config, using default STUN:", err);
    return [{ urls: "stun:stun.l.google.com:19302" }];
  }
}

// ── PeerManager ─────────────────────────────────────────

export class PeerManager {
  private pc: RTCPeerConnection;
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private hasRemoteDescription = false;

  /** Fires when a remote track is received. */
  onRemoteTrack: (track: MediaStreamTrack, streams: readonly MediaStream[]) => void =
    () => {};

  /** Fires when a local ICE candidate should be sent to the remote peer. */
  onIceCandidate: (candidate: RTCIceCandidate) => void = () => {};

  /** Fires when the overall connection state changes. */
  onConnectionStateChange: (state: RTCPeerConnectionState) => void = () => {};

  constructor(iceServers: RTCIceServer[]) {
    this.pc = new RTCPeerConnection({ iceServers });

    this.pc.ontrack = (e) => {
      this.onRemoteTrack(e.track, e.streams);
    };

    this.pc.onicecandidate = (e) => {
      if (e.candidate) {
        this.onIceCandidate(e.candidate);
      }
    };

    this.pc.onconnectionstatechange = () => {
      this.onConnectionStateChange(this.pc.connectionState);
    };
  }

  get connectionState(): RTCPeerConnectionState {
    return this.pc.connectionState;
  }

  /** Add all tracks from a local MediaStream. */
  addLocalStream(stream: MediaStream): void {
    for (const track of stream.getTracks()) {
      this.pc.addTrack(track, stream);
    }
  }

  /** Create an SDP offer and set it as local description. */
  async createOffer(
    options?: RTCOfferOptions
  ): Promise<RTCSessionDescriptionInit> {
    const offer = await this.pc.createOffer(options);
    await this.pc.setLocalDescription(offer);
    return this.pc.localDescription!;
  }

  /** Create a new offer with iceRestart to recover from ICE failures. */
  async restartIce(): Promise<RTCSessionDescriptionInit> {
    return this.createOffer({ iceRestart: true });
  }

  /** Handle an incoming SDP offer, returns the SDP answer. */
  async handleOffer(
    sdp: RTCSessionDescriptionInit
  ): Promise<RTCSessionDescriptionInit> {
    await this.pc.setRemoteDescription(new RTCSessionDescription(sdp));
    this.hasRemoteDescription = true;
    this.flushCandidates();

    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    return this.pc.localDescription!;
  }

  /** Handle an incoming SDP answer. */
  async handleAnswer(sdp: RTCSessionDescriptionInit): Promise<void> {
    await this.pc.setRemoteDescription(new RTCSessionDescription(sdp));
    this.hasRemoteDescription = true;
    this.flushCandidates();
  }

  /** Add a remote ICE candidate (queued if remote description not yet set). */
  addIceCandidate(candidate: RTCIceCandidateInit): void {
    if (this.hasRemoteDescription) {
      this.pc.addIceCandidate(new RTCIceCandidate(candidate)).catch((err) => {
        console.warn("[webrtc] Failed to add ICE candidate:", err);
      });
    } else {
      this.pendingCandidates.push(candidate);
    }
  }

  /** Close the peer connection and release resources. */
  close(): void {
    this.pc.close();
  }

  private flushCandidates(): void {
    for (const candidate of this.pendingCandidates) {
      this.pc.addIceCandidate(new RTCIceCandidate(candidate)).catch((err) => {
        console.warn("[webrtc] Failed to add queued ICE candidate:", err);
      });
    }
    this.pendingCandidates = [];
  }
}
