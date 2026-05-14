import type { InputHTMLAttributes } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/design-system/variants";

type SearchFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
};

export function SearchField({ id, label, className, ...props }: SearchFieldProps) {
  const fieldId = id ?? props.name;

  return (
    <label className="block" htmlFor={fieldId}>
      <span className="sr-only">{label}</span>
      <span className="flex min-h-12 items-center rounded-control border border-border bg-surface px-3.5 text-muted shadow-chip transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
        <Search aria-hidden="true" className="mr-2.5 size-5 shrink-0 text-primary" strokeWidth={2.25} />
        <input
          id={fieldId}
          type="search"
          aria-label={label}
          className={cn("min-w-0 flex-1 bg-transparent text-body text-text outline-none placeholder:text-muted/70", className)}
          {...props}
        />
      </span>
    </label>
  );
}
