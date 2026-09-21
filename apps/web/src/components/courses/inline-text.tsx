/**
 * `` `code` ``, `**bold**`, `*italic*`, `{{O(n)}}` and `~~term~~` inside course text and
 * titles. Deliberately not a markdown parser — five patterns, split by hand. An italic
 * needs a non-space character just inside each asterisk, so arithmetic like `2 * 3 * 4`
 * in prose is left alone.
 *
 * `{{...}}` and `~~...~~` are the two small inline "coloured boxes" the owner asked for
 * (task 052): a complexity pill for the `O(n)`/`O(log n)` terms that recur constantly and
 * were previously buried in prose, and a key-term chip for the word being defined. Both
 * pair colour with the label itself (the term/complexity text is always shown), never
 * colour alone. Content already wraps real code (including literal `{{...}}` array
 * literals) in backticks, so the code pattern always wins at that position first.
 */
export function InlineText({ text }: { text: string }) {
  const tokens = tokenize(text);
  return (
    <>
      {tokens.map((token, i) =>
        token.kind === "code" ? (
          <code key={i} className="rounded bg-surface-sunken px-1.5 py-0.5 font-mono text-[0.9em] text-ink">
            {token.text}
          </code>
        ) : token.kind === "bold" ? (
          <strong key={i} className="font-semibold text-ink">
            {token.text}
          </strong>
        ) : token.kind === "italic" ? (
          <em key={i}>{token.text}</em>
        ) : token.kind === "complexity" ? (
          <span key={i} className="pill pill-accent font-mono normal-case">
            {token.text}
          </span>
        ) : token.kind === "chip" ? (
          <span
            key={i}
            className="rounded px-1 py-0.5 font-medium text-ink"
            style={{ backgroundColor: "color-mix(in srgb, var(--highlight) 22%, transparent)" }}
          >
            {token.text}
          </span>
        ) : (
          <span key={i}>{token.text}</span>
        ),
      )}
    </>
  );
}

type Token = { kind: "text" | "code" | "bold" | "italic" | "complexity" | "chip"; text: string };

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  const pattern = /`([^`]+)`|\*\*([^*]+)\*\*|\*(?=\S)([^*]*?\S)\*|\{\{([^}]+)\}\}|~~([^~]+)~~/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ kind: "text", text: text.slice(lastIndex, match.index) });
    }
    if (match[1] !== undefined) {
      tokens.push({ kind: "code", text: match[1] });
    } else if (match[2] !== undefined) {
      tokens.push({ kind: "bold", text: match[2] });
    } else if (match[3] !== undefined) {
      tokens.push({ kind: "italic", text: match[3] });
    } else if (match[4] !== undefined) {
      tokens.push({ kind: "complexity", text: match[4] });
    } else if (match[5] !== undefined) {
      tokens.push({ kind: "chip", text: match[5] });
    }
    lastIndex = pattern.lastIndex;
  }
  if (lastIndex < text.length) {
    tokens.push({ kind: "text", text: text.slice(lastIndex) });
  }
  return tokens;
}

/** The same text with inline markup removed — for `<title>`, meta descriptions and keys. */
export function plainText(text: string): string {
  return tokenize(text)
    .map((t) => t.text)
    .join("");
}
