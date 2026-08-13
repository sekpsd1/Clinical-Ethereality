"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Check, Pencil, X } from "lucide-react";
import {
  updateProfileContactAction,
  type UpdateProfileContactActionState
} from "@/features/profile/actions";
import { cn } from "@/lib/design-system/variants";

const initialState: UpdateProfileContactActionState = {
  status: "idle",
  message: ""
};

export function AccountContactEditor({
  rows,
  email,
  phone,
  phoneVerified
}: {
  rows: Array<{ label: string; value: string }>;
  email: string | null;
  phone: string | null;
  phoneVerified: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [state, action] = useActionState(updateProfileContactAction, initialState);

  useEffect(() => {
    if (state.status === "success") {
      setEditing(false);
    }
  }, [state.status]);

  return (
    <div className="space-y-3">
      {rows.slice(0, 3).map((row) => (
        <ContactRow key={row.label} label={row.label} value={row.value} />
      ))}

      {editing ? (
        <form action={action} className="space-y-3 rounded-[18px] border border-primary/20 bg-white/80 p-4 shadow-sm">
          <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#6e797a]">
            อีเมล
            <input
              type="email"
              name="email"
              defaultValue={email ?? ""}
              autoComplete="email"
              inputMode="email"
              placeholder="name@example.com"
              className="mt-2 h-11 w-full rounded-[8px] border border-[#bdc9ca]/60 bg-white px-3 text-sm font-medium normal-case tracking-normal text-[#191c1e] outline-none focus:border-primary"
            />
          </label>

          <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#6e797a]">
            เบอร์โทรศัพท์
            <input
              type="tel"
              name="phone"
              defaultValue={phone ?? ""}
              autoComplete="tel"
              inputMode="tel"
              placeholder="0812345678"
              className="mt-2 h-11 w-full rounded-[8px] border border-[#bdc9ca]/60 bg-white px-3 text-sm font-medium normal-case tracking-normal text-[#191c1e] outline-none focus:border-primary"
            />
          </label>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full border border-[#bdc9ca]/60 bg-white text-sm font-bold text-[#3e494a]"
            >
              <X aria-hidden="true" className="size-4" />
              ยกเลิก
            </button>
            <SaveContactButton />
          </div>
        </form>
      ) : (
        <>
          <ContactRow label="อีเมล" value={email ?? "ยังไม่ได้ระบุ"} />
          <ContactRow label="เบอร์โทรศัพท์" value={phone ?? "ยังไม่ได้ระบุ"} />
          <ContactRow label="สถานะยืนยันเบอร์" value={phoneVerified ? "ยืนยันแล้ว" : "รอยืนยัน"} />
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-white shadow-chip active:scale-[0.99]"
          >
            <Pencil aria-hidden="true" className="size-4" />
            แก้ไขข้อมูลติดต่อ
          </button>
        </>
      )}

      {state.status !== "idle" ? (
        <p
          role="status"
          className={cn(
            "rounded-[8px] px-3 py-2 text-sm font-semibold leading-6",
            state.status === "success" ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
          )}
        >
          {state.message}
        </p>
      ) : null}
    </div>
  );
}

function ContactRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-white/50 bg-white/70 p-4 shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#6e797a]">{label}</p>
      <p className="mt-2 break-words text-sm font-bold leading-6 text-[#191c1e]">{value}</p>
    </div>
  );
}

function SaveContactButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-white shadow-chip disabled:opacity-60"
    >
      <Check aria-hidden="true" className="size-4" />
      {pending ? "กำลังบันทึก..." : "บันทึก"}
    </button>
  );
}
