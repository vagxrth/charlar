"use client";

import { RoomGuard } from "../../../../_components/room-guard";
import { RoomHeader } from "../../../../_components/room-header";
import { useSocket } from "../../../../_lib/socket-context";
import { useChat } from "../_hooks/use-chat";
import { MessageInput } from "./message-input";
import { MessageList } from "./message-list";
import { PresenceBar } from "./presence-bar";
import { TypingIndicator } from "./typing-indicator";

export function ChatRoom({ code }: { code: string }) {
  const { status } = useSocket();
  const { messages, sendMessage, handleTyping, peerTyping } = useChat();

  return (
    <RoomGuard code={code}>
      <div className="flex h-svh flex-col">
        <RoomHeader />
        <PresenceBar />
        <MessageList messages={messages} />
        <TypingIndicator visible={peerTyping} />
        <MessageInput
          onSend={sendMessage}
          onTyping={handleTyping}
          disabled={status !== "connected"}
        />
      </div>
    </RoomGuard>
  );
}
