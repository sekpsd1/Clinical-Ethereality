"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Save } from "lucide-react";
import { upsertProductAction } from "@/features/admin/products/actions";
import { cn } from "@/lib/design-system/variants";
import type { AdminProductActionState } from "@/features/admin/products/actions";
import type { AdminProductItem } from "@/features/admin/products/types";

type AdminProductFormProps = {
  product?: AdminProductItem;
};

const initialActionState: AdminProductActionState = {
  status: "idle",
  message: ""
};

export function AdminProductForm({ product }: AdminProductFormProps) {
  const [state, action] = useActionState(upsertProductAction, initialActionState);

  return (
    <form action={action} className="rounded-[8px] border border-border bg-white/85 p-4 shadow-payment-card">
      {product ? <input type="hidden" name="productId" value={product.id} /> : null}
      <div className="grid gap-3">
        <TextField label="Name" name="name" defaultValue={product?.name ?? ""} placeholder="Product name" />
        <TextField label="Slug" name="slug" defaultValue={product?.slug ?? ""} placeholder="clinical-product-name" />
        <TextField label="Image URL" name="imageUrl" defaultValue={product?.imageUrl ?? ""} placeholder="/images/..." />
        <label>
          <span className="block text-[10px] font-bold uppercase text-muted">Description</span>
          <textarea
            className="mt-1 min-h-20 w-full resize-none rounded-[8px] border border-border bg-white px-3 py-2 text-sm leading-5 text-text outline-none transition focus:border-primary"
            defaultValue={product?.description ?? ""}
            name="description"
            placeholder="Short clinical product description"
          />
        </label>
        <div className="grid grid-cols-[1fr_1fr] gap-2">
          <TextField label="Price" name="price" defaultValue={product?.price ?? "0.00"} placeholder="0.00" type="number" />
          <label>
            <span className="block text-[10px] font-bold uppercase text-muted">Status</span>
            <select
              className="mt-1 h-10 w-full rounded-[8px] border border-border bg-white px-3 text-sm font-bold text-text outline-none transition focus:border-primary"
              defaultValue={product?.status ?? "draft"}
              name="status"
            >
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
          </label>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-border/70 pt-3">
          <label className="flex min-w-0 items-center gap-2 text-xs font-bold text-muted">
            <input
              className="size-4 rounded border-border text-primary"
              defaultChecked={product?.requiresPrescription ?? false}
              name="requiresPrescription"
              type="checkbox"
            />
            Requires prescription
          </label>
          <SubmitButton label={product ? "Save product" : "Create product"} />
        </div>
      </div>
      {state.status !== "idle" ? (
        <p
          className={cn(
            "mt-3 text-right text-[11px] font-semibold leading-4",
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

function TextField({
  defaultValue,
  label,
  name,
  placeholder,
  type = "text"
}: {
  defaultValue: string;
  label: string;
  name: string;
  placeholder: string;
  type?: "number" | "text";
}) {
  return (
    <label>
      <span className="block text-[10px] font-bold uppercase text-muted">{label}</span>
      <input
        className="mt-1 h-10 w-full rounded-[8px] border border-border bg-white px-3 text-sm font-bold text-text outline-none transition focus:border-primary"
        defaultValue={defaultValue}
        min={type === "number" ? 0 : undefined}
        name={name}
        placeholder={placeholder}
        step={type === "number" ? "0.01" : undefined}
        type={type}
      />
    </label>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-white disabled:opacity-60"
      aria-label={label}
      disabled={pending}
    >
      <Save aria-hidden="true" className="size-4" strokeWidth={2.1} />
    </button>
  );
}
