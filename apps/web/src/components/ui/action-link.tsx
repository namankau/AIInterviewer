import type { Route } from "next";
import Link from "next/link";

import { buttonStyles, type ButtonSize, type ButtonVariant } from "@/components/ui/button";

export function ActionLink({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
}: {
  href: Route;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={buttonStyles({ variant, size, className })}>
      {children}
    </Link>
  );
}
