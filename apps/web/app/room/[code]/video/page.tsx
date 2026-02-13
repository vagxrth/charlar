import { VideoRoom } from "./_components/video-room";

export default async function VideoPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  return <VideoRoom code={code} />;
}
