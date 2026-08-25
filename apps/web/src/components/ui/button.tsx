import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "quiet";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-md text-body font-medium " +
  "transition-colors disabled:cursor-not-allowed disabled:opacity-50";

const SIZES = "px-5 py-2.5";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-accent-contrast hover:bg-accent-strong",
  secondary: "border border-line bg-surface-raised text-ink hover:bg-surface-sunken",
  quiet: "text-ink-muted hover:text-ink",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({ variant = "primary", className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={cn(BASE, SIZES, VARIANTS[variant], className)} {...props} />;
}
