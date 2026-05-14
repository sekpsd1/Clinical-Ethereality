import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/design-system/variants";

const buttonVariants = {
  primary: "bg-primary text-white shadow-selected-slot hover:bg-primary-strong focus-visible:outline-primary",
  secondary: "border border-border bg-surface text-text shadow-chip hover:bg-primary/5 focus-visible:outline-primary",
  ghost: "text-primary hover:bg-primary/10 focus-visible:outline-primary",
  danger: "bg-danger text-white hover:bg-danger/90 focus-visible:outline-danger"
};

const buttonSizes = {
  sm: "min-h-9 px-3 text-label",
  md: "min-h-11 px-4 text-sm",
  lg: "min-h-12 px-5 text-body"
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof buttonVariants;
  size?: keyof typeof buttonSizes;
};

export function Button({
  type = "button",
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-control font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
        buttonVariants[variant],
        buttonSizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
