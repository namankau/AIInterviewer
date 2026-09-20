import type { TreeFrame } from "@/content/courses/types";
import { boundingBox, layoutTree } from "@/lib/courses/viz-layout";
import { STATE_FILL, STATE_LABEL, STATE_STROKE } from "@/components/courses/viz/viz-tokens";

const RADIUS = 20;
const PAD = 28;

/** A binary tree, laid out by inorder position (x) and depth (y) — see `layoutTree`. */
export function TreeViz({ frame }: { frame: TreeFrame }) {
  const positions = layoutTree(frame.nodes, frame.rootId);
  const byId = new Map(frame.nodes.map((n) => [n.id, n]));
  const posById = new Map(positions.map((p) => [p.id, p]));
  const box = boundingBox(positions, PAD + RADIUS);
  const summary = frame.nodes.map((n) => `${n.value}${n.state ? ` (${STATE_LABEL[n.state]})` : ""}`).join(", ");

  return (
    <svg
      viewBox={`${box.minX} ${box.minY} ${box.width} ${box.height}`}
      width="100%"
      height={box.height}
      role="img"
      aria-label={`Binary tree: ${summary}`}
      className="max-w-full"
    >
      {frame.nodes.flatMap((node) => {
        const from = posById.get(node.id);
        if (!from) return [];
        return [node.left, node.right].flatMap((childId) => {
          if (!childId) return [];
          const to = posById.get(childId);
          if (!to) return [];
          return [
            <line
              key={`${node.id}-${childId}`}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke="var(--line-strong)"
              strokeWidth={1.5}
            />,
          ];
        });
      })}
      {positions.map((p) => {
        const node = byId.get(p.id);
        if (!node) return null;
        const fill = node.state ? STATE_FILL[node.state] : "var(--surface-raised)";
        const stroke = node.state ? STATE_STROKE[node.state] : "var(--line-strong)";
        return (
          <g key={p.id}>
            <circle cx={p.x} cy={p.y} r={RADIUS} fill={fill} stroke={stroke} strokeWidth={1.5} />
            <text x={p.x} y={p.y + 5} textAnchor="middle" className="font-mono" fontSize={13} fill="var(--ink)">
              {node.value}
            </text>
            {node.state ? (
              <text x={p.x} y={p.y + RADIUS + 14} textAnchor="middle" fontSize={9} fill="var(--ink-subtle)">
                {STATE_LABEL[node.state]}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
