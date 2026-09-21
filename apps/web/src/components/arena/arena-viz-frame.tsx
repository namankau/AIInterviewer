import type { Viz } from "@/content/courses/types";
import { ArrayViz } from "@/components/courses/viz/array-viz";
import { ListViz } from "@/components/courses/viz/list-viz";
import { SeqViz } from "@/components/courses/viz/seq-viz";
import { TreeViz } from "@/components/courses/viz/tree-viz";
import { GraphViz } from "@/components/courses/viz/graph-viz";
import { GridViz } from "@/components/courses/viz/grid-viz";
import { CallStackViz } from "@/components/courses/viz/callstack-viz";

/**
 * Renders exactly one frame of a `viz`, with none of `VizBlock`'s previous/next/scrub
 * controls (task 055's "what happens next?" challenge). Reusing the same per-shape
 * components as the chapter reader (`viz-block.tsx`) rather than a second visualisation
 * system — but deliberately not reusing `VizBlock` itself, since its step slider would let
 * a learner scrub straight to the answer frame.
 */
export function ArenaVizFrame({ viz, frameIndex }: { viz: Viz; frameIndex: number }) {
  const index = Math.min(Math.max(0, frameIndex), viz.frames.length - 1);
  switch (viz.type) {
    case "array":
      return <ArrayViz frame={viz.frames[index]!} />;
    case "list":
      return <ListViz frame={viz.frames[index]!} />;
    case "stack":
    case "queue":
      return <SeqViz frame={viz.frames[index]!} type={viz.type} />;
    case "tree":
      return <TreeViz frame={viz.frames[index]!} />;
    case "graph":
      return <GraphViz frame={viz.frames[index]!} />;
    case "table":
      return <GridViz frame={viz.frames[index]!} />;
    case "callstack":
      return <CallStackViz frame={viz.frames[index]!} />;
  }
}
