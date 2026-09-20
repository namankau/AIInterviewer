import type { GridFrame } from "@/content/courses/types";

/** A DP table / hash-bucket grid. Rendered as a real `<table>`, not SVG — a table of
 * numbers is more legible to a screen reader and to a reader with no colour than a grid of
 * boxes would be, and it still respects "server-rendered without JS" (task 047 §2). */
export function GridViz({ frame }: { frame: GridFrame }) {
  const isHighlighted = (r: number, c: number) => frame.highlight?.some(([hr, hc]) => hr === r && hc === c) ?? false;

  return (
    <div className="overflow-x-auto">
      <table className="border-collapse text-caption">
        <thead>
          <tr>
            {frame.rowLabels ? <th className="w-8" /> : null}
            {frame.colLabels?.map((label, i) => (
              <th key={i} className="border border-line px-2.5 py-1.5 font-mono text-micro text-ink-subtle">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {frame.rows.map((row, r) => (
            <tr key={r}>
              {frame.rowLabels ? (
                <th scope="row" className="border border-line px-2.5 py-1.5 font-mono text-micro text-ink-subtle">
                  {frame.rowLabels[r]}
                </th>
              ) : null}
              {row.map((cell, c) => {
                const highlighted = isHighlighted(r, c);
                return (
                  <td
                    key={c}
                    className={[
                      "border px-2.5 py-1.5 text-center font-mono",
                      highlighted ? "border-accent bg-accent-wash font-semibold text-ink" : "border-line text-ink-muted",
                    ].join(" ")}
                  >
                    {cell === null ? <span aria-label="empty">&middot;</span> : cell}
                    {highlighted ? <span className="sr-only"> (highlighted)</span> : null}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
