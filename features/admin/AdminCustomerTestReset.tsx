"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArchiveRestore, SearchCheck, ShieldAlert } from "lucide-react";
import {
  previewCustomerTestResetAction,
  resetCustomerTestAccountAction,
  type AdminCustomerTestResetActionState
} from "@/features/admin/customers/actions";
import { cn } from "@/lib/design-system/variants";

const initialState: AdminCustomerTestResetActionState = {
  status: "idle",
  message: ""
};

export function AdminCustomerTestReset({ customerId }: { customerId: string }) {
  const router = useRouter();
  const [confirmationText, setConfirmationText] = useState("");
  const [lastOperation, setLastOperation] = useState<"preview" | "reset">("preview");
  const [previewState, previewAction, isPreviewPending] = useActionState(
    previewCustomerTestResetAction,
    initialState
  );
  const [resetState, resetAction, isResetPending] = useActionState(
    resetCustomerTestAccountAction,
    initialState
  );
  const preview = previewState.preview?.eligible ? previewState.preview : undefined;
  const expectedConfirmation = preview?.target?.confirmationText ?? "";

  useEffect(() => {
    if (resetState.status === "success") {
      router.push("/admin/customers");
      router.refresh();
    }
  }, [resetState.status, router]);

  return (
    <section className="rounded-[8px] border border-danger/25 bg-danger/5 p-4 shadow-payment-card lg:p-5">
      <div className="flex gap-3">
        <ShieldAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-danger" strokeWidth={2.1} />
        <div>
          <p className="text-label font-bold uppercase text-danger">เครื่องมือ UAT</p>
          <h2 className="mt-1 font-headline text-lg font-bold text-text">รีเซ็ตบัญชีทดสอบเป็นผู้ใช้ใหม่</h2>
          <p className="mt-1 text-xs leading-5 text-muted">
            ใช้ได้เฉพาะ LINE ID ที่อยู่ใน allowlist บัญชีทดสอบ ระบบจะลบบัญชีและข้อมูล Test/UAT ที่เชื่อมโยงทั้งหมด
            พร้อมคืนสต๊อกที่เคยจองหรือตัดไป ก่อนให้ LINE บัญชีเดิมเข้าใหม่เป็นผู้ใช้ใหม่
          </p>
        </div>
      </div>

      <form
        action={previewAction}
        className="mt-4 border-t border-danger/15 pt-4"
        onSubmit={() => {
          setLastOperation("preview");
          setConfirmationText("");
        }}
      >
        <input type="hidden" name="customerId" value={customerId} />
        <button
          type="submit"
          disabled={isPreviewPending || isResetPending}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[8px] border border-danger/25 bg-white px-4 text-sm font-bold text-danger disabled:opacity-60 sm:w-auto"
        >
          <SearchCheck aria-hidden="true" className="size-4" strokeWidth={2.1} />
          {isPreviewPending ? "กำลังตรวจสอบ..." : "Preview ข้อมูลก่อนรีเซ็ต"}
        </button>
      </form>

      {preview?.target && preview.counts ? (
        <div className="mt-4 rounded-[8px] border border-danger/20 bg-white p-4">
          <p className="text-xs font-bold text-text">รายการที่จะถูกลบ</p>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3">
            <ResetCount label="แบบประเมิน" value={preview.counts.assessments} />
            <ResetCount label="การปรึกษา" value={preview.counts.consultations} />
            <ResetCount label="ใบสั่งยา" value={preview.counts.prescriptions} />
            <ResetCount label="ออเดอร์" value={preview.counts.orders} />
            <ResetCount label="การชำระเงิน" value={preview.counts.payments} />
            <ResetCount label="ข้อมูลชุมชน" value={preview.counts.communityRecords} />
            <ResetCount label="โปรไฟล์/การแจ้งเตือน" value={preview.counts.profileRecords} />
            <ResetCount label="ไฟล์" value={preview.counts.files} />
            <ResetCount label="ความยินยอม" value={preview.counts.consents} />
            <ResetCount label="เซสชันที่ใช้งาน" value={preview.counts.activeSessions} />
            <ResetCount label="คืนยอดจองสต๊อก" value={preview.counts.reservedUnitsToRelease} />
            <ResetCount label="คืนจำนวนสินค้า" value={preview.counts.stockUnitsToRestore} />
          </dl>

          <form
            action={resetAction}
            className="mt-4 border-t border-danger/15 pt-4"
            onSubmit={() => setLastOperation("reset")}
          >
            <input type="hidden" name="customerId" value={customerId} />
            <input type="hidden" name="confirmedCustomerId" value={preview.target.customerId} />
            <input type="hidden" name="expectedUpdatedAt" value={preview.target.expectedUpdatedAt} />
            <input type="hidden" name="expectedFingerprint" value={preview.target.expectedFingerprint} />
            <label className="block text-xs font-bold text-text" htmlFor={`reset-confirmation-${customerId}`}>
              พิมพ์ข้อความนี้เพื่อยืนยัน: <span className="select-all text-danger">{expectedConfirmation}</span>
            </label>
            <input
              id={`reset-confirmation-${customerId}`}
              name="confirmationText"
              value={confirmationText}
              onChange={(event) => setConfirmationText(event.target.value)}
              autoComplete="off"
              className="mt-2 h-11 w-full rounded-[8px] border border-border bg-white px-3 text-sm font-semibold text-text outline-none focus:border-danger"
              placeholder={expectedConfirmation}
            />
            <button
              type="submit"
              disabled={isResetPending || confirmationText.trim() !== expectedConfirmation}
              className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[8px] bg-danger px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto"
            >
              <ArchiveRestore aria-hidden="true" className="size-4" strokeWidth={2.1} />
              {isResetPending ? "กำลังรีเซ็ต..." : "ยืนยันรีเซ็ตบัญชีทดสอบ"}
            </button>
          </form>
        </div>
      ) : null}

      <p
        className={cn(
          "mt-3 text-xs font-semibold leading-5",
          (lastOperation === "reset" ? resetState.status : previewState.status) === "success"
            ? "text-success"
            : (lastOperation === "reset" ? resetState.status : previewState.status) === "error"
              ? "text-danger"
              : "text-muted"
        )}
        role="status"
      >
        {lastOperation === "reset" && resetState.status !== "idle"
          ? resetState.message
          : lastOperation === "preview" && previewState.status !== "idle"
            ? previewState.message
            : "ต้อง Preview และยืนยันรหัสอ้างอิงก่อน ระบบจึงจะเริ่ม Transaction เดียวทั้งชุด"}
      </p>
    </section>
  );
}

function ResetCount({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-border/50 py-1.5">
      <dt className="text-muted">{label}</dt>
      <dd className="font-bold text-text">{value}</dd>
    </div>
  );
}
