import type { Metadata } from "next";
import { Literata } from "next/font/google";
import { copy } from "@/lib/copy";
import "./globals.css";

// Self-hosted at build time by next/font — no runtime request to Google.
const literata = Literata({
  subsets: ["latin", "latin-ext", "cyrillic"],
  variable: "--font-literata",
  display: "swap",
});

export const metadata: Metadata = {
  title: copy.appName,
  description: copy.tagline,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // Browser extensions add attributes to <html> before hydration; ignore only this tag.
    <html lang="sr" className={literata.variable} suppressHydrationWarning>
      <body className="bg-paper text-ink antialiased">{children}</body>
    </html>
  );
}
