import { BookPrint } from "@/components/print/BookPrint";

export default async function PrintPage({ searchParams }: { searchParams: Promise<{ book?: string; from?: string }> }) {
  const { book, from } = await searchParams;
  // Back to the part the author came from; without one, the library.
  const backHref = from ? `/write/${encodeURIComponent(from)}` : "/";
  return <BookPrint key={book ?? ""} bookId={book ?? ""} backHref={backHref} />;
}
