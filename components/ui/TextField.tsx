import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/design-system/variants";

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
};

export function TextField({ id, label, hint, error, className, ...props }: TextFieldProps) {
  const fieldId = id ?? props.name;
  const hintId = hint && fieldId ? `${fieldId}-hint` : undefined;
  const errorId = error && fieldId ? `${fieldId}-error` : undefined;

  return (
    <label className="grid gap-1.5 text-sm font-semibold text-text" htmlFor={fieldId}>
      {label}
      <input
        id={fieldId}
        aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
        aria-invalid={error ? true : undefined}
        className={cn(
          "min-h-12 w-full rounded-control border border-border bg-surface px-3.5 text-body text-text shadow-chip outline-none transition placeholder:text-muted/70 focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:bg-surface/60 disabled:text-muted",
          error && "border-danger focus:border-danger focus:ring-danger/15",
          className
        )}
        {...props}
      />
      {hint ? (
        <span id={hintId} className="text-label font-medium text-muted">
          {hint}
        </span>
      ) : null}
      {error ? (
        <span id={errorId} className="text-label font-semibold text-danger">
          {error}
        </span>
      ) : null}
    </label>
  );
}
