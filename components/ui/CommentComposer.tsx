import type { ComponentPropsWithoutRef } from "react";
import { Send } from "lucide-react";
import { cn } from "@/lib/design-system/variants";

type CommentComposerHiddenField = {
  name: string;
  value: string;
};

type CommentComposerProps = {
  action: NonNullable<ComponentPropsWithoutRef<"form">["action"]>;
  hiddenFields?: CommentComposerHiddenField[];
  inputName?: string;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  className?: string;
};

export function CommentComposer({
  action,
  hiddenFields = [],
  inputName = "body",
  placeholder = "Add a comment...",
  label = "Comment",
  disabled,
  className
}: CommentComposerProps) {
  return (
    <form
      action={action}
      className={cn(
        "mx-auto flex h-16 w-full max-w-mobile items-center rounded-full border border-white/50 bg-white/70 p-2 shadow-2xl backdrop-blur-[24px]",
        className
      )}
    >
      {hiddenFields.map((field) => (
        <input key={`${field.name}:${field.value}`} type="hidden" name={field.name} value={field.value} />
      ))}
      <input
        type="text"
        name={inputName}
        aria-label={label}
        placeholder={placeholder}
        className="min-w-0 flex-1 border-0 bg-transparent px-4 text-sm outline-none placeholder:text-[#6e797a] focus:ring-0"
      />
      <button
        type="submit"
        disabled={disabled}
        aria-label="Send comment"
        className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-white shadow-lg disabled:bg-[#6e797a]"
      >
        <Send aria-hidden="true" className="size-6 fill-white" />
      </button>
    </form>
  );
}
