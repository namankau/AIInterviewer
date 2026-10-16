import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "onDark" | "ghost" | "quiet" | "destructive";
export type ButtonSize = "sm" | "md" | "lg";

const BASE = "disabled:cursor-not-allowed disabled:opacity-50";

const SIZES: Record<ButtonSize, string> = {
  sm: "min-h-11 px-3 py-2 text-caption",
  md: "min-h-11 px-5 py-2.5 text-body",
  lg: "min-h-12 px-6 py-3 text-body",
};

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "action-primary",
  secondary: "action-secondary",
  onDark: "action-on-dark",
  ghost: "action-quiet",
  quiet: "action-quiet",
  destructive: "action-destructive",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export function buttonStyles({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) {
  return cn(BASE, VARIANTS[variant], SIZES[size], className);
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  loading = false,
  disabled,
  children,
  "aria-busy": ariaBusy,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonStyles({ variant, size, className })}
      disabled={disabled || loading}
      {...props}
      aria-busy={loading || ariaBusy}
    >
      {loading ? <span aria-hidden="true" className="size-4 animate-pulse rounded-full border-2 border-current border-r-transparent" /> : null}
      {children}
    </button>
  );
}
