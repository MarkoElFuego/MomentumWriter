import { StartScreen } from "@/components/book/StartScreen";

export default async function StartPage({ searchParams }: { searchParams: Promise<{ book?: string }> }) {
  const { book } = await searchParams;
  return <StartScreen key={book ?? ""} bookId={book ?? ""} />;
}
