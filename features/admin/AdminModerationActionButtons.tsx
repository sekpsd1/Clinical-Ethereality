"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Archive, Eye, EyeOff } from "lucide-react";
import { updateModerationItemAction } from "@/features/admin/moderation/actions";
import { cn } from "@/lib/design-system/variants";
import type { AdminModerationActionState } from "@/features/admin/moderation/actions";
import type { AdminModerationQueueItem } from "@/features/admin/moderation/types";

type AdminModerationActionButtonsProps = {
  item: Pick<AdminModerationQueueItem, "id" | "status" | "type">;
};

const initialActionState: AdminModerationActionState = {
  status: "idle",
  message: ""
};

export function AdminModerationActionButtons({ item }: AdminModerationActionButtonsProps) {
  const [restoreState, restoreAction] = useActionState(updateModerationItemAction, initialActionState);
  const [hideState, hideAction] = useActionState(updateModerationItemAction, initialActionState);
  const [archiveState, archiveAction] = useActionState(updateModerationItemAction, initialActionState);
  const actionState = archiveState.status !== "idle" ? archiveState : hideState.status !== "idle" ? hideState : restoreState;
  const isArchived = item.status === "archived";
  const isHidden = item.status === "hidden";

  return (
    <div className="flex shrink-0 flex-col items-end gap-2">
      <div className="flex gap-2">
        {isHidden || isArchived ? (
          <ModerationActionForm
            action={restoreAction}
            actionName="restore"
            className="bg-success text-white"
            icon="restore"
            item={item}
          />
        ) : null}
        {!isHidden && !isArchived ? (
          <ModerationActionForm
            action={hideAction}
            actionName="hide"
            className="bg-warning text-white"
            icon="hide"
            item={item}
          />
        ) : null}
        {!isArchived ? (
          <ModerationActionForm
            action={archiveAction}
            actionName="archive"
            className="bg-danger text-white"
            icon="archive"
            item={item}
          />
        ) : null}
      </div>
      {actionState.status !== "idle" ? (
        <p
          className={cn(
            "max-w-[180px] text-right text-[11px] font-semibold leading-4",
            actionState.status === "success" ? "text-success" : "text-danger"
          )}
          role="status"
        >
          {actionState.message}
        </p>
      ) : null}
    </div>
  );
}

function ModerationActionForm({
  action,
  actionName,
  className,
  icon,
  item
}: {
  action: (payload: FormData) => void;
  actionName: "restore" | "hide" | "archive";
  className: string;
  icon: "restore" | "hide" | "archive";
  item: Pick<AdminModerationQueueItem, "id" | "type">;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="itemId" value={item.id} />
      <input type="hidden" name="itemType" value={item.type} />
      <input type="hidden" name="action" value={actionName} />
      <ActionIconButton ariaLabel={`${actionName} ${item.type}`} className={className} icon={icon} />
    </form>
  );
}

function ActionIconButton({
  ariaLabel,
  className,
  icon
}: {
  ariaLabel: string;
  className: string;
  icon: "restore" | "hide" | "archive";
}) {
  const { pending } = useFormStatus();
  const Icon = icon === "restore" ? Eye : icon === "hide" ? EyeOff : Archive;

  return (
    <button
      type="submit"
      className={cn("inline-flex size-9 items-center justify-center rounded-full disabled:opacity-60", className)}
      aria-label={ariaLabel}
      disabled={pending}
    >
      <Icon aria-hidden="true" className="size-4" strokeWidth={2.1} />
    </button>
  );
}
