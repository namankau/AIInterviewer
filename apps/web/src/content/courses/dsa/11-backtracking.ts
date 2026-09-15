import type { Chapter } from "@/content/courses/types";

export const chapterBacktracking: Chapter = {
  slug: "backtracking",
  title: "Backtracking: Subsets, Permutations, N-Queens",
  summary:
    "Try a choice, recurse, and undo it if it doesn't lead anywhere — the systematic way to explore every " +
    "possibility without missing one or repeating one, applied to subsets, permutations, and N-Queens.",
  minutes: 17,
  blocks: [
    {
      kind: "p",
      text:
        "Some problems genuinely need every possibility explored: every subset of a set, every arrangement " +
        "of a list, every way to place queens on a board so none attacks another. **Backtracking** is " +
        "recursion with one added discipline: make a choice, recurse into what that choice leads to, then " +
        "*undo* the choice before trying the next one — so every branch starts from a clean slate.",
    },
    { kind: "h", text: "The maze-with-a-pencil-mark analogy" },
    {
      kind: "analogy",
      title: "Exploring a maze, marking and erasing your path",
      text:
        "Imagine exploring a maze by walking forward, lightly pencilling your path behind you. At each " +
        "junction, take one unexplored turn and keep going; if that path dead-ends, don't start the whole " +
        "maze over — walk back to the last junction, *erase* the pencil mark for the turn that failed, and " +
        "try the next unexplored turn from there. The eraser is exactly what backtracking adds to plain " +
        "recursion: undoing a choice, cleanly, so the next choice at that junction starts from the same " +
        "state the first one did. Without the eraser, your pencil marks from an abandoned path would " +
        "confuse every path tried afterwards. Where the analogy stops: a real maze has one correct exit; " +
        "backtracking problems usually want *every* valid path (every subset, every arrangement), not just " +
        "the first one found — though, as N-Queens below shows, sometimes you can also stop at the first.",
    },
    { kind: "h", text: "Subsets: choose it, or don't" },
    {
      kind: "p",
      text:
        "The subsets of `[1, 2, 3]` are every combination of included/excluded elements: `[]`, `[1]`, `[2]`, " +
        "`[3]`, `[1,2]`, and so on, 8 in total (2³, since each of the 3 elements is independently in or " +
        "out). The backtracking shape: record the current subset at every step of the recursion (not just " +
        "at the end), then try adding each remaining element one at a time, recurse, and remove it again " +
        "before trying the next.",
    },
    {
      kind: "code",
      caption:
        "All three problems — subsets, permutations, N-Queens — as backtracking, each following the same " +
        "choose/recurse/undo shape.",
      code:
        "import java.util.ArrayList;\n" +
        "import java.util.List;\n" +
        "\n" +
        "public class BacktrackingDemo {\n" +
        "    static List<List<Integer>> subsets(int[] nums) {\n" +
        "        List<List<Integer>> result = new ArrayList<>();\n" +
        "        backtrackSubsets(nums, 0, new ArrayList<>(), result);\n" +
        "        return result;\n" +
        "    }\n" +
        "\n" +
        "    static void backtrackSubsets(int[] nums, int start, List<Integer> current, List<List<Integer>> result) {\n" +
        "        result.add(new ArrayList<>(current));\n" +
        "        for (int i = start; i < nums.length; i++) {\n" +
        "            current.add(nums[i]);\n" +
        "            backtrackSubsets(nums, i + 1, current, result);\n" +
        "            current.remove(current.size() - 1);\n" +
        "        }\n" +
        "    }\n" +
        "\n" +
        "    static List<List<Integer>> permutations(int[] nums) {\n" +
        "        List<List<Integer>> result = new ArrayList<>();\n" +
        "        backtrackPermutations(nums, new ArrayList<>(), new boolean[nums.length], result);\n" +
        "        return result;\n" +
        "    }\n" +
        "\n" +
        "    static void backtrackPermutations(int[] nums, List<Integer> current, boolean[] used, List<List<Integer>> result) {\n" +
        "        if (current.size() == nums.length) {\n" +
        "            result.add(new ArrayList<>(current));\n" +
        "            return;\n" +
        "        }\n" +
        "        for (int i = 0; i < nums.length; i++) {\n" +
        "            if (used[i]) {\n" +
        "                continue;\n" +
        "            }\n" +
        "            used[i] = true;\n" +
        "            current.add(nums[i]);\n" +
        "            backtrackPermutations(nums, current, used, result);\n" +
        "            current.remove(current.size() - 1);\n" +
        "            used[i] = false;\n" +
        "        }\n" +
        "    }\n" +
        "\n" +
        "    static int solveNQueens(int n) {\n" +
        "        int[] colInRow = new int[n];\n" +
        "        int[] count = {0};\n" +
        "        List<int[]> first = new ArrayList<>();\n" +
        "        backtrackQueens(colInRow, 0, n, count, first);\n" +
        "        if (!first.isEmpty()) {\n" +
        "            printBoard(first.get(0), n);\n" +
        "        }\n" +
        "        return count[0];\n" +
        "    }\n" +
        "\n" +
        "    static void backtrackQueens(int[] colInRow, int row, int n, int[] count, List<int[]> first) {\n" +
        "        if (row == n) {\n" +
        "            count[0]++;\n" +
        "            if (first.isEmpty()) {\n" +
        "                first.add(colInRow.clone());\n" +
        "            }\n" +
        "            return;\n" +
        "        }\n" +
        "        for (int col = 0; col < n; col++) {\n" +
        "            if (isSafe(colInRow, row, col)) {\n" +
        "                colInRow[row] = col;\n" +
        "                backtrackQueens(colInRow, row + 1, n, count, first);\n" +
        "            }\n" +
        "        }\n" +
        "    }\n" +
        "\n" +
        "    static boolean isSafe(int[] colInRow, int row, int col) {\n" +
        "        for (int r = 0; r < row; r++) {\n" +
        "            int c = colInRow[r];\n" +
        "            if (c == col || Math.abs(c - col) == Math.abs(r - row)) {\n" +
        "                return false;\n" +
        "            }\n" +
        "        }\n" +
        "        return true;\n" +
        "    }\n" +
        "\n" +
        "    static void printBoard(int[] colInRow, int n) {\n" +
        "        for (int r = 0; r < n; r++) {\n" +
        "            StringBuilder sb = new StringBuilder();\n" +
        "            for (int c = 0; c < n; c++) {\n" +
        '                sb.append(colInRow[r] == c ? "Q" : ".");\n' +
        "            }\n" +
        "            System.out.println(sb);\n" +
        "        }\n" +
        "    }\n" +
        "\n" +
        "    public static void main(String[] args) {\n" +
        "        int[] nums = {1, 2, 3};\n" +
        '        System.out.println("subsets of [1,2,3]: " + subsets(nums));\n' +
        '        System.out.println("permutations of [1,2,3]: " + permutations(nums));\n' +
        '        System.out.println("4-queens solutions found: " + solveNQueens(4));\n' +
        "    }\n" +
        "}\n",
      output:
        "subsets of [1,2,3]: [[], [1], [1, 2], [1, 2, 3], [1, 3], [2], [2, 3], [3]]\n" +
        "permutations of [1,2,3]: [[1, 2, 3], [1, 3, 2], [2, 1, 3], [2, 3, 1], [3, 1, 2], [3, 2, 1]]\n" +
        ".Q..\n" +
        "...Q\n" +
        "Q...\n" +
        "..Q.\n" +
        "4-queens solutions found: 2",
    },
    {
      kind: "trace",
      title: "backtrackSubsets([1,2,3]) — a slice of the choose/recurse/undo pattern",
      steps: [
        "start=0, current=[]. Record []. Loop begins: i=0.",
        "current.add(1) -> current=[1]. Recurse with start=1.",
        "  Inside: record [1]. Loop: i=1. current.add(2) -> [1,2]. Recurse with start=2.",
        "    Inside: record [1,2]. Loop: i=2. current.add(3) -> [1,2,3]. Recurse with start=3.",
        "      Inside: record [1,2,3]. Loop doesn't run (start=3 = length). Return.",
        "    current.remove(last) -> back to [1,2]. Loop ends (i=2 was the last). Return.",
        "  current.remove(last) -> back to [1]. Loop continues: i=2. current.add(3) -> [1,3]. Recurse...",
        "  ...eventually current.remove(last) -> back to [1]. Loop ends. Return.",
        "current.remove(last) -> back to []. Loop continues: i=1 (element 2), then i=2 (element 3), each " +
          "exploring their own branch the same way — every 'add, recurse, remove' triple is the choose, " +
          "explore, undo of backtracking, visible directly in the code.",
      ],
    },
    { kind: "h", text: "Permutations: every element, every position" },
    {
      kind: "p",
      text:
        "Permutations differ from subsets in what varies: subsets vary *which* elements are included; " +
        "permutations always include every element, varying their *order*. The `used[]` array tracks which " +
        "elements are already placed in the current arrangement, so each recursive level tries every " +
        "not-yet-used element next — `[1,2,3]` has 3! = 6 permutations, matching the output exactly.",
    },
    { kind: "h", text: "N-Queens: choices that must satisfy a constraint" },
    {
      kind: "p",
      text:
        "N-Queens places n queens on an n×n board so no two attack each other (same row, column, or " +
        "diagonal). This adds one more idea to the pattern: `isSafe` prunes branches *before* recursing into " +
        "them, rather than generating every placement and filtering afterwards — a queen in row 0 that " +
        "attacks a queen in row 1 means every arrangement built on top of that pair is hopeless, so " +
        "backtracking never even tries them. This pruning is what keeps N-Queens tractable at all; " +
        "generating every possible placement of n queens on n² squares first, and checking each " +
        "afterwards, would be enormously more expensive.",
    },
    {
      kind: "trace",
      title: "backtrackQueens for n=4 — the first successful placement found",
      steps: [
        "row=0: try col=0. Safe (nothing placed yet). colInRow=[0,_,_,_]. Recurse to row=1.",
        "row=1: col=0 unsafe (same column as row 0). col=1 unsafe (diagonal: |0-1|=1=|0-1|). col=2 is " +
          "safe. colInRow=[0,2,_,_]. Recurse to row=2.",
        "row=2: col=0 unsafe (column), col=1 unsafe (diagonal to row1's col2? |2-1|=1, |1-2|=1, unsafe), " +
          "col=2 unsafe (column), col=3 unsafe (diagonal to row0's col0: |3-0|=3, |2-0|=2, safe; but " +
          "diagonal to row1's col2: |3-2|=1=|2-1|, unsafe). No safe column at row 2 — dead end.",
        "Backtrack to row=1: no more columns to try after col=2 — dead end. Backtrack to row=0.",
        "row=0: try col=1. Recurse forward again with a completely fresh board state (col=0's attempt left " +
          "no trace) — eventually this branch reaches row=4 with colInRow=[1,3,0,2], printed as the board " +
          "above.",
      ],
    },
    {
      kind: "table",
      head: ["Problem", "Time (roughly)", "Space", "Why"],
      rows: [
        [
          "subsets(n elements)",
          "O(2ⁿ)",
          "O(n) recursion depth (excluding the O(2ⁿ) output itself)",
          "Each of the n elements is independently included or excluded, giving 2ⁿ possible subsets, " +
            "each one built and recorded.",
        ],
        [
          "permutations(n elements)",
          "O(n!)",
          "O(n) recursion depth",
          "The first position has n choices, the second n-1, and so on — n × (n-1) × ... × 1 " +
            "total arrangements.",
        ],
        [
          "N-Queens(n)",
          "Worst case O(nⁿ), far less in practice",
          "O(n) recursion depth",
          "Without pruning, n queens across n rows with n choices each is nⁿ; isSafe prunes most " +
            "branches long before they reach the bottom, which is why it finishes quickly for boards " +
            "interview-sized problems actually use.",
        ],
      ],
    },
    {
      kind: "pitfall",
      items: [
        "Forgetting the 'undo' step (`current.remove(...)`, `used[i] = false`) — without it, choices from " +
          "one branch leak into sibling branches, producing wrong or duplicated results, the exact bug the " +
          "maze analogy's eraser prevents.",
        "Pruning too late — checking a constraint only once a full arrangement is built (instead of as " +
          "early as `isSafe` does) means exploring huge numbers of branches that were doomed from their " +
          "first bad choice.",
        "Confusing subsets (order doesn't matter, elements can be excluded) with permutations (every " +
          "element included, order matters) — they look superficially similar in code but explore " +
          "different, and differently sized, spaces.",
        "Not cloning the current list/array before adding it to the results — `result.add(current)` without " +
          "`new ArrayList<>(current)` stores a reference that later mutations will change retroactively.",
      ],
    },
    {
      kind: "remember",
      items: [
        "Backtracking is recursion plus a deliberate undo: choose, recurse, undo, try the next choice.",
        "Subsets: 2ⁿ possibilities (each element in or out). Permutations: n! possibilities (every " +
          "element, every order).",
        "Pruning (rejecting a doomed branch early, like isSafe) is what makes constrained backtracking " +
          "(N-Queens) tractable, not just theoretically correct.",
        "Always copy a mutable current-state list before storing it in results — otherwise later 'undo' " +
          "steps corrupt already-recorded answers.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"Generate all possible ...\" (subsets, combinations, arrangements, valid placements) is close to " +
          "a direct signal for backtracking — the phrase 'all possible' rules out a single-pass technique.",
        "Being asked to add a constraint mid-problem (\"now only subsets that sum to a target\") tests " +
          "whether you can prune inside the existing recursion, rather than generating everything and " +
          "filtering afterwards.",
        "N-Queens itself is a very common way backtracking is tested precisely because it forces both the " +
          "choose/undo shape and an early-pruning constraint in one problem.",
      ],
    },
    { kind: "h", text: "Practice problems" },
    {
      kind: "list",
      ordered: true,
      items: [
        "Describe, in your own words, how you'd adapt the subsets backtracking code to only record subsets " +
          "that sum to a given target, pruning early rather than filtering the final list.",
        "Given a string, describe a backtracking approach to generate every possible way to insert commas " +
          "to split it into non-empty pieces.",
        "Describe, in your own words, how permutations would need to change to correctly handle an input " +
          "array containing duplicate values, avoiding duplicate permutations in the output.",
        "For a grid where you must place non-attacking rooks (which only attack along rows and columns, not " +
          "diagonals), describe how the isSafe check would differ from N-Queens.",
        "Explain, in your own words, why generating every arrangement first and checking validity afterward " +
          "would be far slower than N-Queens's approach of checking isSafe before each recursive call.",
      ],
    },
    {
      kind: "quiz",
      question: "What is the key discipline backtracking adds on top of plain recursion?",
      options: [
        "It never uses a base case",
        "It always returns void",
        "It undoes each choice (removing it from the current state) before trying the next choice at the " +
          "same level",
        "It only works on arrays, never on strings",
      ],
      answer: 2,
      why:
        "The 'undo' step — removing the last choice before trying the next one — is what keeps each branch " +
        "independent, ensuring one explored path doesn't contaminate the state seen by the next path tried.",
    },
    {
      kind: "quiz",
      question: "Why does subsets([1,2,3]) produce exactly 8 subsets, while permutations([1,2,3]) produces 6?",
      options: [
        "Both should produce the same count; one of the two is a bug",
        "Subsets counts every include/exclude combination (2³=8); permutations counts every ordering " +
          "of all 3 elements (3!=6)",
        "8 and 6 are arbitrary and unrelated to the input size",
        "Because permutations only considers even-length arrangements",
      ],
      answer: 1,
      why:
        "Subsets and permutations count fundamentally different things: subsets vary which elements appear " +
        "at all (2 choices per element, independently), while permutations always include every element " +
        "and vary only their order (n! orderings for n elements).",
    },
    {
      kind: "quiz",
      question: "In the N-Queens code, what is the purpose of checking isSafe before making a recursive call, rather than after a full board is built?",
      options: [
        "It has no effect on performance, only on code style",
        "It prunes clearly invalid branches immediately, avoiding wasted exploration of placements that " +
          "were already doomed",
        "isSafe is required by Java syntax for recursive methods",
        "It guarantees exactly one solution will be found",
      ],
      answer: 1,
      why:
        "Checking safety before recursing means the algorithm never explores the (large) space of " +
        "placements that build on an already-invalid partial arrangement — this early pruning is what " +
        "makes N-Queens practical rather than checking all nⁿ full placements afterward.",
    },
  ],
};
