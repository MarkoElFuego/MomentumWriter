import { BookList } from "@/components/structure/BookList";
import { copy } from "@/lib/copy";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-xl px-6 py-24">
      <h1 className="font-serif text-3xl">{copy.appName}</h1>
      <p className="mt-2 text-muted">{copy.tagline}</p>
      <h2 className="mb-4 mt-16 text-sm uppercase tracking-wider text-muted">
        {copy.library.title}
      </h2>
      <BookList />
    </main>
  );
}
