"use client";

import { useState } from "react";

/** A small copy-to-clipboard control sitting over a code block. */
export function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can be denied by the browser; the code is still selectable by hand.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="absolute top-2.5 right-2.5 rounded border border-line-strong bg-surface-raised px-2 py-1 text-micro text-ink-subtle transition-colors hover:text-ink"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
