import type { ReactNode } from "react";

export type BadgeVariant = "primary" | "secondary" | "success" | "warning" | "destructive";

const variants: Record<BadgeVariant, string> = {
  primary: "bg-primary/10 text-primary-strong",
  secondary: "bg-surface text-muted-foreground",
  success: "bg-success/10 text-success-strong",
  warning: "bg-warning/10 text-warning-strong",
  destructive: "bg-destructive/10 text-destructive-strong",
};

interface Props {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
}

export function Badge({ variant = "secondary", children, className = "" }: Props) {
  return (
    <span
      className={`inline-flex select-none items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${variants[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
