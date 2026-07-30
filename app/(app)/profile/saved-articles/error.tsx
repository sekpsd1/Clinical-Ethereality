"use client";

export default function SavedArticlesError({
  reset
}: {
  error: Error & {
    digest?: string;
  };
  reset: () => void;
}) {
  return (
    <div className="min-h-dvh bg-[#f7f9fb] px-6 pt-28">
      <div className="mx-auto max-w-mobile rounded-[24px] bg-white/75 p-7 text-center shadow-lg">
        <h1 className="text-xl font-extrabold text-primary">ยังโหลดรายการที่บันทึกไม่ได้</h1>
        <button type="button" onClick={reset} className="mt-6 rounded-full bg-primary px-6 py-3 text-sm font-bold text-white">
          ลองใหม่
        </button>
      </div>
    </div>
  );
}
