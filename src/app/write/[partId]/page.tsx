import { WriteScreen } from "@/components/editor/WriteScreen";

export default async function WritePage({ params }: { params: Promise<{ partId: string }> }) {
  const { partId } = await params;
  // key: a new part always gets a fresh editor and autosave.
  return <WriteScreen key={partId} partId={partId} />;
}
