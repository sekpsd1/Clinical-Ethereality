"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { PlusCircle, Send } from "lucide-react";
import { sendConsultationMessageAction } from "@/features/consultations/chat/actions";
import { cn } from "@/lib/design-system/variants";
import type { SendConsultationMessageActionState } from "@/features/consultations/chat/actions";

type ConsultationMessageComposerProps = {
  consultationId: string | null;
  canSend: boolean;
};

const initialActionState: SendConsultationMessageActionState = {
  status: "idle",
  message: ""
};

export function ConsultationMessageComposer({ consultationId, canSend }: ConsultationMessageComposerProps) {
  const [state, formAction] = useActionState(sendConsultationMessageAction, initialActionState);
  const disabled = !consultationId || !canSend;

  return (
    <form action={formAction} className="flex min-h-[56px] min-w-0 flex-1 items-center rounded-2xl bg-[#e6e8ea]/50 px-3 py-1">
      <input type="hidden" name="consultationId" value={consultationId ?? ""} />
      <button type="button" aria-label="เพิ่มไฟล์แนบ" className="p-2 text-[#94a3b8]" disabled>
        <PlusCircle aria-hidden="true" className="size-6" strokeWidth={2.1} />
      </button>
      <div className="min-w-0 flex-1">
        <textarea
          aria-label="ข้อความ"
          name="body"
          placeholder={disabled ? "ยังไม่มีห้องแชทที่พร้อมส่งข้อความ" : "พิมพ์ข้อความ..."}
          rows={1}
          className="min-w-0 w-full resize-none border-none bg-transparent py-3 text-sm text-slate-700 outline-none placeholder:text-[#94a3b8] focus:ring-0"
          disabled={disabled}
        />
        <p
          className={cn(
            "-mt-2 pb-1 text-[10px] font-semibold",
            state.status === "success" ? "text-success" : state.status === "error" ? "text-danger" : "text-[#64748b]"
          )}
          role="status"
        >
          {state.message}
        </p>
      </div>
      <SendButton disabled={disabled} />
    </form>
  );
}

function SendButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" aria-label="ส่งข้อความ" className="p-2 text-primary disabled:opacity-40" disabled={disabled || pending}>
      <Send aria-hidden="true" className="size-6 fill-primary" strokeWidth={2} />
    </button>
  );
}
