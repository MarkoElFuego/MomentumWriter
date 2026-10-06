import { DraftEnd } from "@/components/book/DraftEnd";

export default async function DraftEndPage({ searchParams }: { searchParams: Promise<{ book?: string; from?: string }> }) {
  const { book, from } = await searchParams;
  // Back to the part the author came from; without one, the library.
  const backHref = from ? `/write/${encodeURIComponent(from)}` : "/";
  return <DraftEnd key={book ?? ""} bookId={book ?? ""} backHref={backHref} />;
}
