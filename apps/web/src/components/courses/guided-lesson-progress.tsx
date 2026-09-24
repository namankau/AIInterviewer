"use client";

import type { ReactNode } from "react";
import { createContext, useContext } from "react";

export interface GuidedLessonProgress {
  allBeatsVisited: boolean;
  totalCount: number;
  visitedCount: number;
}

const GuidedLessonProgressContext = createContext<GuidedLessonProgress | null>(null);

export function GuidedLessonProgressProvider({
  children,
  progress,
}: {
  children: ReactNode;
  progress: GuidedLessonProgress;
}) {
  return (
    <GuidedLessonProgressContext.Provider value={progress}>
      {children}
    </GuidedLessonProgressContext.Provider>
  );
}

/** Null outside a guided lesson, so the completion control stays reusable elsewhere. */
export function useGuidedLessonProgress(): GuidedLessonProgress | null {
  return useContext(GuidedLessonProgressContext);
}
