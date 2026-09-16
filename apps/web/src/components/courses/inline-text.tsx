/**
 * `` `code` ``, `**bold**` and `*italic*` inside course text and titles. Deliberately not a
 * markdown parser — three patterns, split by hand. An italic needs a non-space character
 * just inside each asterisk, so arithmetic like `2 * 3 * 4` in prose is left alone.
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
        ) : (
          <span key={i}>{token.text}</span>
        ),
      )}
    </>
  );
}

type Token = { kind: "text" | "code" | "bold" | "italic"; text: string };

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  const pattern = /`([^`]+)`|\*\*([^*]+)\*\*|\*(?=\S)([^*]*?\S)\*/g;
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
