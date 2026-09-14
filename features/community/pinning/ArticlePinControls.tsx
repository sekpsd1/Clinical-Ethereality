"use client";

import Link from "next/link";
import type { Route } from "next";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { MoreHorizontal, Pencil, Pin, PinOff } from "lucide-react";
import { updateArticlePinAction } from "@/features/community/pinning/actions";
import type { ArticlePinActionState } from "@/features/community/pinning/actions";
import type { ArticlePinAction } from "@/features/community/pinning/schema";
import { cn } from "@/lib/design-system/variants";

const initialPinActionState: ArticlePinActionState = {
  status: "idle",
  message: ""
};

export function ArticlePinActionForm({
  articleId,
  action,
  disabled = false,
  presentation = "manager"
}: {
  articleId: string;
  action: ArticlePinAction;
  disabled?: boolean;
  presentation?: "manager" | "menu";
}) {
  const [state, formAction] = useActionState(updateArticlePinAction, initialPinActionState);
  const label = action === "pin" ? "ปักหมุดโพสต์" : "ถอนหมุดโพสต์";

  return (
    <div className={presentation === "menu" ? "min-w-0" : "flex min-w-0 flex-col items-end gap-1"}>
      <form action={formAction}>
        <input type="hidden" name="articleId" value={articleId} />
        <input type="hidden" name="action" value={action} />
        <PinSubmitButton action={action} disabled={disabled} label={label} presentation={presentation} />
      </form>
      <p
        aria-live="polite"
        className={cn(
          state.status === "idle" ? "sr-only" : "mt-1 max-w-56 text-[11px] font-semibold leading-4",
          state.status === "success" ? "text-success" : state.status === "error" ? "text-danger" : undefined
        )}
        role="status"
      >
        {state.message}
      </p>
    </div>
  );
}

function PinSubmitButton({
  action,
  disabled,
  label,
  presentation
}: {
  action: ArticlePinAction;
  disabled: boolean;
  label: string;
  presentation: "manager" | "menu";
}) {
  const { pending } = useFormStatus();
  const Icon = action === "pin" ? Pin : PinOff;

  return (
    <button
      type="submit"
      aria-label={label}
      className={cn(
        "inline-flex min-h-10 items-center justify-center gap-2 text-xs font-bold outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50",
        presentation === "menu"
          ? "w-full rounded-[8px] px-3 text-left text-text hover:bg-primary/5"
          : action === "pin"
            ? "rounded-[8px] bg-primary px-3 text-white"
            : "rounded-[8px] border border-border bg-white px-3 text-primary"
      )}
      disabled={disabled || pending}
    >
      <Icon aria-hidden="true" className="size-4" />
      {pending ? "กำลังบันทึก…" : label}
    </button>
  );
}

export function CommunityPostActionsMenu({
  articleId,
  editHref,
  pinned,
  canManagePins
}: {
  articleId: string;
  editHref?: string;
  pinned: boolean;
  canManagePins: boolean;
}) {
  if (!editHref && !canManagePins) return null;

  return (
    <details className="relative ml-auto shrink-0">
      <summary
        aria-label="เปิดเมนูโพสต์"
        className="flex size-10 cursor-pointer list-none items-center justify-center rounded-full text-slate-400 outline-none hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-primary/30 [&::-webkit-details-marker]:hidden"
      >
        <MoreHorizontal aria-hidden="true" className="size-6" />
      </summary>
      <div
        className="absolute right-0 top-11 z-30 min-w-52 rounded-[12px] border border-border bg-white p-2 shadow-glass"
        aria-label="คำสั่งสำหรับโพสต์"
      >
        {editHref ? (
          <Link
            href={editHref as Route}
            className="flex min-h-10 items-center gap-2 rounded-[8px] px-3 text-xs font-bold text-text outline-none hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            <Pencil aria-hidden="true" className="size-4" />
            แก้ไขโพสต์
          </Link>
        ) : null}
        {canManagePins ? (
          <ArticlePinActionForm
            articleId={articleId}
            action={pinned ? "unpin" : "pin"}
            presentation="menu"
          />
        ) : null}
      </div>
    </details>
  );
}
