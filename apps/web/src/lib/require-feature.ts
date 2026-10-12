import { notFound } from "next/navigation";

import { courseEnabled, featureEnabled, type ProductFeature } from "@/lib/flags";

export function requireFeature(feature: ProductFeature): void {
  if (!featureEnabled(feature)) notFound();
}

export function requireCourse(courseSlug: string): void {
  requireFeature("courses");
  if (!courseEnabled(courseSlug)) notFound();
}

export function requireArenaCourse(courseSlug: string): void {
  requireFeature("arena");
  if (!courseEnabled(courseSlug)) notFound();
}
