import type { Metadata } from "next";
import { Courier_Prime, Inter, Literata } from "next/font/google";
import { copy } from "@/lib/copy";
import { THEME_BOOT_SCRIPT } from "@/lib/themes";
import "./globals.css";

// Self-hosted at build time by next/font — no runtime request to Google.
const literata = Literata({
  subsets: ["latin", "latin-ext", "cyrillic"],
  variable: "--font-literata",
  display: "swap",
});

// Theme fonts (masina, magla): not preloaded — fetched only when a theme uses them.
const courierPrime = Courier_Prime({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  variable: "--font-courier-prime",
  display: "swap",
  preload: false,
});

const inter = Inter({
  subsets: ["latin", "latin-ext", "cyrillic"],
  variable: "--font-inter",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: copy.appName,
  description: copy.tagline,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // Browser extensions add attributes to <html> before hydration, and the
    // theme script sets data-theme; ignore only this tag.
    <html
      lang="sr"
      className={`${literata.variable} ${courierPrime.variable} ${inter.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Saved theme before the first paint — no flash of the wrong colors. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="bg-paper text-ink antialiased">{children}</body>
    </html>
  );
}
