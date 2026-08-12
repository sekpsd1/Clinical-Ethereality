"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Archive } from "lucide-react";
import { archiveProductAction, type AdminProductActionState } from "@/features/admin/products/actions";
import { cn } from "@/lib/design-system/variants";
import type { AdminProductItem } from "@/features/admin/products/types";

const initialActionState: AdminProductActionState = {
  status: "idle",
  message: ""
};

export function AdminProductArchiveButton({ product }: { product: Pick<AdminProductItem, "id" | "name"> }) {
  const [state, action] = useActionState(archiveProductAction, initialActionState);

  return (
    <div className="min-w-0 flex-1">
      <form
        action={action}
        onSubmit={(event) => {
          if (!window.confirm(`ยืนยันเก็บ “${product.name}” เป็นรายการถาวร? สินค้าจะไม่แสดงในหน้าร้าน`)) {
            event.preventDefault();
          }
        }}
      >
        <input type="hidden" name="productId" value={product.id} />
        <ArchiveSubmitButton productName={product.name} />
      </form>
      {state.status === "error" ? (
        <p className="mt-1 text-[10px] font-semibold leading-4 text-danger" role="status">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}

function ArchiveSubmitButton({ productName }: { productName: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className={cn(
        "inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-[8px] px-2 text-xs font-bold",
        "bg-danger/10 text-danger disabled:opacity-60"
      )}
      aria-label={`เก็บถาวร ${productName}`}
      disabled={pending}
    >
      <Archive aria-hidden="true" className="size-3.5" strokeWidth={2.1} />
      {pending ? "กำลังเก็บ…" : "เก็บถาวร"}
    </button>
  );
}
