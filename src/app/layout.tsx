import type { Metadata } from "next";
import { copy } from "@/lib/copy";
import "./globals.css";

export const metadata: Metadata = {
  title: copy.appName,
  description: copy.tagline,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sr">
      <body>{children}</body>
    </html>
  );
}
