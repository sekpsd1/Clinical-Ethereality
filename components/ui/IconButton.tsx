import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/design-system/variants";

const iconButtonVariants = {
  primary: "bg-primary text-white shadow-chip hover:bg-primary-strong focus-visible:outline-primary",
  secondary: "border border-border bg-surface text-primary shadow-chip hover:bg-primary/5 focus-visible:outline-primary",
  ghost: "text-primary hover:bg-primary/10 focus-visible:outline-primary",
  danger: "bg-danger text-white hover:bg-danger/90 focus-visible:outline-danger"
};

const iconButtonSizes = {
  sm: "size-9",
  md: "size-10",
  lg: "size-12"
};

type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  label: string;
  icon: ReactNode;
  variant?: keyof typeof iconButtonVariants;
  size?: keyof typeof iconButtonSizes;
};

export function IconButton({
  type = "button",
  label,
  icon,
  variant = "ghost",
  size = "md",
  className,
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
        iconButtonVariants[variant],
        iconButtonSizes[size],
        className
      )}
      {...props}
    >
      {icon}
    </button>
  );
}
