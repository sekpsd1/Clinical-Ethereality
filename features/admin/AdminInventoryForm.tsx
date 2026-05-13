"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Save } from "lucide-react";
import { updateInventoryAction } from "@/features/admin/inventory/actions";
import { cn } from "@/lib/design-system/variants";
import type { AdminInventoryActionState } from "@/features/admin/inventory/actions";
import type { AdminInventoryItem } from "@/features/admin/inventory/types";

const initialActionState: AdminInventoryActionState = {
  status: "idle",
  message: ""
};

export function AdminInventoryForm({ item }: { item: Pick<AdminInventoryItem, "id" | "quantity" | "lowStockThreshold"> }) {
  const [state, action] = useActionState(updateInventoryAction, initialActionState);

  return (
    <form action={action} className="mt-4 border-t border-border/70 pt-3">
      <input type="hidden" name="inventoryId" value={item.id} />
      <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
        <NumberField label="คงคลัง" name="quantity" defaultValue={item.quantity} />
        <NumberField label="เตือนต่ำกว่า" name="lowStockThreshold" defaultValue={item.lowStockThreshold} />
        <SubmitButton />
      </div>
      {state.status !== "idle" ? (
        <p
          className={cn(
            "mt-2 text-right text-[11px] font-semibold leading-4",
            state.status === "success" ? "text-success" : "text-danger"
          )}
          role="status"
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

function NumberField({ label, name, defaultValue }: { label: string; name: string; defaultValue: number }) {
  return (
    <label className="min-w-0">
      <span className="block text-[10px] font-bold uppercase text-muted">{label}</span>
      <input
        className="mt-1 h-10 w-full rounded-[8px] border border-border bg-white px-3 text-sm font-bold text-text outline-none transition focus:border-primary"
        defaultValue={defaultValue}
        inputMode="numeric"
        min={0}
        name={name}
        type="number"
      />
    </label>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className="inline-flex size-10 items-center justify-center rounded-full bg-primary text-white disabled:opacity-60"
      aria-label="บันทึกสต็อก"
      disabled={pending}
    >
      <Save aria-hidden="true" className="size-4" strokeWidth={2.1} />
    </button>
  );
}
