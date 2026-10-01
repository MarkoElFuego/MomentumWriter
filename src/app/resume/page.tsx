import { ResumeScreen } from "@/components/resume/ResumeScreen";

export default async function ResumePage({ searchParams }: { searchParams: Promise<{ book?: string }> }) {
  const { book } = await searchParams;
  return <ResumeScreen key={book ?? ""} bookId={book ?? ""} />;
}
