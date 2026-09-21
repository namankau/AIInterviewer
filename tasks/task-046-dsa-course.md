# Task 046 — DSA course

Uses the course framework and **the writing standard in task 045** (read it first —
every rule applies). Code in Java 17, compiled and run locally with real output.
Course slug `dsa`, title "Data Structures & Algorithms". Register it in
`content/courses/index.ts`. Extend the integrity test if the DSA course needs it
(e.g. every algorithm chapter has a complexity table and a trace).

Extra rules for DSA chapters:
- Every algorithm gets: the intuition first (analogy), then a dry run (`trace`) on a
  small input, then code, then a time/space complexity `table` with a one-line reason
  for each bound.
- Each chapter ends with 3–5 practice problems described **in our own words** (name the
  pattern, not a LeetCode number or link, no copied statements).

## Chapters
1. **Foundations:** what DSA is and why interviews test it; time and space complexity
   (Big-O, counting steps, common classes with a growth table); how to approach a problem
   in an interview (clarify, brute force, optimise, test).
2. **Arrays and strings:** arrays in memory; two pointers; sliding window; prefix sums;
   string techniques (frequency counts, palindromes, anagrams).
3. **Hashing and recursion:** hashing (HashMap/HashSet patterns); recursion (call stack,
   base case); backtracking (subsets, permutations, N-Queens).
4. **Sorting and searching:** simple sorts (bubble, selection, insertion); merge sort;
   quick sort; binary search (and binary search on the answer).
5. **Linear structures:** linked lists (reverse, cycle detection); stacks (monotonic
   stack); queues and deques.
6. **Trees:** tree basics and traversals (DFS orders, level order); binary search trees;
   heaps and priority queues; tries.
7. **Graphs:** representation, BFS and DFS; shortest paths (BFS on unweighted,
   Dijkstra); topological sort; union-find.
8. **Paradigms:** greedy; dynamic programming — intuition (memoisation vs tabulation);
   DP patterns (0/1 knapsack, LCS, LIS, grid paths); bit manipulation.

Branches: `feat/courses-dsa-1` (modules 1–4), `feat/courses-dsa-2` (5–8).
