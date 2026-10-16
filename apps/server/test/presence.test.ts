import { describe, expect, it } from "vitest";

import { PresenceService } from "../src/services/presence-service.js";
import { RoomService } from "../src/services/room-service.js";
import { SessionService } from "../src/services/session-service.js";

describe("presence", () => {
  it("reports a member whose session no longer exists as offline", () => {
    const rooms = new RoomService();
    const sessions = new SessionService(1_000, () => {});
    const live = sessions.create("socket-1");

    const created = rooms.createRoom(live.id, "chat");
    if (!created.ok) throw new Error(created.error);
    // A member with no session behind it, as a missed cleanup would leave.
    rooms.joinRoom(created.data.code, "gone-session");

    const presence = new PresenceService(rooms, sessions).getRoomPresence(
      created.data.code,
      live.id
    );
    if (!presence.ok) throw new Error(presence.error);

    const byId = new Map(presence.data.map((p) => [p.sessionId, p.online]));
    expect(byId.get(live.id)).toBe(true);
    expect(byId.get("gone-session")).toBe(false);
  });
});
