import type { HTMLAttributes, TableHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

export function TableScroll({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("overflow-x-auto rounded-lg border border-line", className)} {...props} />;
}

export function Table({ className, ...props }: TableHTMLAttributes<HTMLTableElement>) {
  return <table className={cn("w-full border-collapse text-left text-caption", className)} {...props} />;
}
