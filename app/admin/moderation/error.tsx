"use client";

export default function AdminModerationError({
  reset
}: {
  error: Error & {
    digest?: string;
  };
  reset: () => void;
}) {
  return (
    <div className="rounded-[8px] border border-danger/25 bg-white/85 p-6 text-center shadow-payment-card">
      <h2 className="text-lg font-bold text-danger">ยังโหลดคิวดูแลชุมชนไม่ได้</h2>
      <p className="mt-2 text-sm text-muted">กรุณาตรวจสอบฐานข้อมูลแล้วลองใหม่</p>
      <button type="button" onClick={reset} className="mt-5 rounded-full bg-primary px-5 py-3 text-sm font-bold text-white">
        ลองใหม่
      </button>
    </div>
  );
}
