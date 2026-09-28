import { WriteScreen } from "@/components/editor/WriteScreen";

export default async function WritePage({ params }: { params: Promise<{ sceneId: string }> }) {
  const { sceneId } = await params;
  // key: a new scene always gets a fresh editor and autosave.
  return <WriteScreen key={sceneId} sceneId={sceneId} />;
}
