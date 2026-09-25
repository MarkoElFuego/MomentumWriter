import { copy } from "@/lib/copy";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-xl px-6 py-24">
      <h1 className="font-serif text-3xl">{copy.appName}</h1>
      <p className="mt-4 opacity-70">{copy.tagline}</p>
    </main>
  );
}
