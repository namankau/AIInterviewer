import { describe, expect, it } from "vitest";

import { boundingBox, layoutGraphRadial, layoutTree } from "@/lib/courses/viz-layout";
import type { GraphNode, TreeNode } from "@/content/courses/types";

describe("layoutTree", () => {
  const nodes: TreeNode[] = [
    { id: "a", value: 5, left: "b", right: "c" },
    { id: "b", value: 3, left: "d", right: null },
    { id: "c", value: 8, left: null, right: null },
    { id: "d", value: 1, left: null, right: null },
  ];

  it("gives every node a position", () => {
    const positions = layoutTree(nodes, "a");
    expect(positions).toHaveLength(4);
    for (const p of positions) {
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
    }
  });

  it("orders nodes left to right by inorder position (d, b, a, c)", () => {
    const positions = layoutTree(nodes, "a");
    const byId = new Map(positions.map((p) => [p.id, p]));
    const d = byId.get("d")!;
    const b = byId.get("b")!;
    const a = byId.get("a")!;
    const c = byId.get("c")!;
    expect(d.x).toBeLessThan(b.x);
    expect(b.x).toBeLessThan(a.x);
    expect(a.x).toBeLessThan(c.x);
  });

  it("puts deeper nodes lower (larger y)", () => {
    const positions = layoutTree(nodes, "a");
    const byId = new Map(positions.map((p) => [p.id, p]));
    expect(byId.get("d")!.y).toBeGreaterThan(byId.get("b")!.y);
    expect(byId.get("b")!.y).toBeGreaterThan(byId.get("a")!.y);
  });

  it("still positions a node unreachable from the given root, instead of dropping it", () => {
    const withOrphan: TreeNode[] = [...nodes, { id: "e", value: 99, left: null, right: null }];
    const positions = layoutTree(withOrphan, "a");
    expect(positions.map((p) => p.id)).toContain("e");
  });

  it("handles a single-node tree", () => {
    const positions = layoutTree([{ id: "a", value: 1, left: null, right: null }], "a");
    expect(positions).toEqual([{ id: "a", x: 0, y: 0 }]);
  });
});

describe("layoutGraphRadial", () => {
  it("returns one position per node, all distinct", () => {
    const nodes: GraphNode[] = ["a", "b", "c", "d"].map((id) => ({ id, label: id }));
    const positions = layoutGraphRadial(nodes);
    expect(positions).toHaveLength(4);
    const keys = positions.map((p) => `${p.x},${p.y}`);
    expect(new Set(keys).size).toBe(4);
  });

  it("places every node at the same distance from the centre", () => {
    const nodes: GraphNode[] = ["a", "b", "c", "d", "e"].map((id) => ({ id, label: id }));
    const positions = layoutGraphRadial(nodes, 100);
    for (const p of positions) {
      const distance = Math.sqrt(p.x * p.x + p.y * p.y);
      expect(distance).toBeCloseTo(100, 0);
    }
  });

  it("handles zero and one node without throwing", () => {
    expect(layoutGraphRadial([])).toEqual([]);
    expect(layoutGraphRadial([{ id: "only", label: "only" }])).toEqual([{ id: "only", x: 0, y: 0 }]);
  });
});

describe("boundingBox", () => {
  it("pads around the given positions", () => {
    const box = boundingBox(
      [
        { id: "a", x: 0, y: 0 },
        { id: "b", x: 100, y: 50 },
      ],
      10,
    );
    expect(box).toEqual({ minX: -10, minY: -10, width: 120, height: 70 });
  });

  it("returns a small default box for no positions", () => {
    expect(boundingBox([], 10)).toEqual({ minX: 0, minY: 0, width: 20, height: 20 });
  });
});
