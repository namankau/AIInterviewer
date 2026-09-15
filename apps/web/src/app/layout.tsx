import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";

import "./globals.css";

/*
 * One bold modern grotesque, carrying both headings and body copy — built into Next's
 * font pipeline (self-hosted at build time, no runtime request to Google), not a new
 * dependency. Variable weight so `font-weight: 700` on headings and 400–500 on body
 * copy both come from the same download.
 */
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "AceMyInterview",
    template: "%s · AceMyInterview",
  },
  description:
    "Voice-first AI mock interviews grounded in how interviews at real employers actually run — " +
    "product companies, service-based IT, consulting, European employers and beyond.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body className="min-h-dvh bg-surface text-ink antialiased">{children}</body>
    </html>
  );
}
