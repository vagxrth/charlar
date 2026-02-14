import type { RoomService } from "./room-service.js";
import type { SessionService } from "./session-service.js";

export interface ParticipantInfo {
  sessionId: string;
  online: boolean;
  nickname: string;
}

export class PresenceService {
  constructor(
    private readonly roomService: RoomService,
    private readonly sessionService: SessionService
  ) {}

  getRoomPresence(
    code: string,
    requesterId: string
  ): { ok: true; data: ParticipantInfo[] } | { ok: false; error: string } {
    if (!this.roomService.isParticipant(code, requesterId)) {
      return { ok: false, error: "Not a participant of this room" };
    }

    const room = this.roomService.getRoom(code);
    if (!room) {
      return { ok: false, error: "Room not found" };
    }

    const participants: ParticipantInfo[] = [...room.participants].map(
      (sessionId) => {
        const session = this.sessionService.getById(sessionId);
        return {
          sessionId,
          online: session?.socketId !== null,
          nickname: session?.nickname ?? "Unknown",
        };
      }
    );

    return { ok: true, data: participants };
  }

  getParticipantCount(code: string): number {
    return this.roomService.getRoom(code)?.participants.size ?? 0;
  }
}
