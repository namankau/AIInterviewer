import type { HTMLAttributes } from "react";

import { cn } from "@/lib/cn";

export function Card({
  interactive = false,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return <div className={cn("card", interactive && "card-interactive", className)} {...props} />;
}
