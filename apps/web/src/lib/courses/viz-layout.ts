import type { GraphNode, TreeNode } from "@/content/courses/types";

/**
 * Pure layout maths for the course visualiser (task 047). Content authors describe
 * *state* (which node is which, who points to whom); these functions turn that into
 * positions a renderer can draw. Kept separate from the SVG components so the maths is
 * unit-testable without rendering anything.
 */

export interface PositionedNode {
  id: string;
  x: number;
  y: number;
}

const H_SPACING = 56;
const V_SPACING = 64;

/**
 * Binary-tree layout: x comes from inorder position (left, node, right), y from depth.
 * A node with a broken/missing child link is treated as a leaf, so a partially-built
 * tree frame still lays out instead of throwing.
 */
export function layoutTree(nodes: TreeNode[], rootId: string): PositionedNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const positions = new Map<string, PositionedNode>();
  let nextX = 0;

  function visit(id: string | null, depth: number): void {
    if (id === null) return;
    const node = byId.get(id);
    if (!node) return;
    visit(node.left, depth + 1);
    const x = nextX;
    nextX += 1;
    positions.set(id, { id, x: x * H_SPACING, y: depth * V_SPACING });
    visit(node.right, depth + 1);
  }

  visit(rootId, 0);

  // Any node unreachable from rootId (shouldn't happen in valid content, but content is
  // hand-authored) still gets a position, laid out to the right, so nothing silently vanishes.
  for (const node of nodes) {
    if (!positions.has(node.id)) {
      positions.set(node.id, { id: node.id, x: nextX * H_SPACING, y: 0 });
      nextX += 1;
    }
  }

  return nodes.map((n) => positions.get(n.id)!);
}

/** Radial layout: nodes evenly spaced on a circle. Fine for the small (<20 node) graphs
 * course examples use; a force-directed or hierarchical layout would be overkill. */
export function layoutGraphRadial(nodes: GraphNode[], radius = 120): PositionedNode[] {
  const n = nodes.length;
  if (n === 0) return [];
  if (n === 1) {
    const only = nodes[0];
    return only ? [{ id: only.id, x: 0, y: 0 }] : [];
  }
  return nodes.map((node, i) => {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    return { id: node.id, x: Math.round(radius * Math.cos(angle)), y: Math.round(radius * Math.sin(angle)) };
  });
}

/** Bounding box helper so an SVG viewBox can fit whatever the layout produced, with padding. */
export function boundingBox(positions: PositionedNode[], pad: number): { minX: number; minY: number; width: number; height: number } {
  if (positions.length === 0) return { minX: 0, minY: 0, width: pad * 2, height: pad * 2 };
  const xs = positions.map((p) => p.x);
  const ys = positions.map((p) => p.y);
  const minX = Math.min(...xs) - pad;
  const maxX = Math.max(...xs) + pad;
  const minY = Math.min(...ys) - pad;
  const maxY = Math.max(...ys) + pad;
  return { minX, minY, width: maxX - minX, height: maxY - minY };
}
