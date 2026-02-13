import { ChatRoom } from "./_components/chat-room";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  return <ChatRoom code={code} />;
}
