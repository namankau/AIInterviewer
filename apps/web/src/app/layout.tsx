import type { Metadata, Viewport } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "InterviewOS",
    template: "%s · InterviewOS",
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
    <html lang="en">
      <body className="min-h-dvh bg-surface text-ink antialiased">{children}</body>
    </html>
  );
}
