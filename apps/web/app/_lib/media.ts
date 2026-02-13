/**
 * Media capture utilities — wraps getUserMedia with meaningful error messages.
 */

export async function getLocalStream(
  constraints: MediaStreamConstraints = { audio: true, video: true }
): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia(constraints);
  } catch (err) {
    if (err instanceof DOMException) {
      switch (err.name) {
        case "NotAllowedError":
          throw new Error("Camera/microphone permission denied");
        case "NotFoundError":
          throw new Error("No camera or microphone found");
        case "NotReadableError":
          throw new Error("Camera or microphone is already in use");
        case "OverconstrainedError":
          throw new Error("Requested media constraints cannot be satisfied");
        default:
          throw new Error(`Media error: ${err.message}`);
      }
    }
    throw err;
  }
}

export function stopStream(stream: MediaStream): void {
  for (const track of stream.getTracks()) {
    track.stop();
  }
}
