import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "solid" | "ghost" | "accent" | "destructive";
type Size = "sm" | "md";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

const variants: Record<Variant, string> = {
  solid: "bg-surface text-foreground hover:bg-surface-hover",
  ghost: "bg-transparent text-foreground hover:bg-primary/10",
  accent: "bg-primary text-primary-foreground hover:opacity-90",
  destructive: "bg-destructive text-destructive-foreground hover:opacity-90",
};

const sizes: Record<Size, string> = {
  sm: "px-2.5 py-2 text-xs rounded-md",
  md: "px-3 py-2 text-xs rounded-lg",
};

export function Button({ variant = "solid", size = "md", className = "", ...props }: Props) {
  return (
    <button
      type="button"
      className={`inline-flex cursor-pointer select-none items-center justify-center gap-1.5 font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    />
  );
}
