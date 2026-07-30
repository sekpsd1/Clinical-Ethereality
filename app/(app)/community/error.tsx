"use client";

export default function CommunityError({
  reset
}: {
  error: Error & {
    digest?: string;
  };
  reset: () => void;
}) {
  return (
    <div className="min-h-dvh bg-[#f7f9fb] px-6 pt-28">
      <div className="mx-auto max-w-mobile rounded-[24px] border border-white/40 bg-white/75 p-7 text-center shadow-lg">
        <h1 className="text-xl font-extrabold text-primary">ยังเปิด Community ไม่ได้</h1>
        <p className="mt-3 text-sm leading-6 text-[#3e494a]">ไม่มีข้อมูลส่วนตัวถูกส่งออก กรุณาลองโหลดใหม่</p>
        <button type="button" onClick={reset} className="mt-6 rounded-full bg-primary px-6 py-3 text-sm font-bold text-white">
          ลองใหม่
        </button>
      </div>
    </div>
  );
}
