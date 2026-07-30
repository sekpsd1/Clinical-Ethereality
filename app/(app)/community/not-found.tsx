import Link from "next/link";

export default function CommunityNotFound() {
  return (
    <div className="min-h-dvh bg-[#f7f9fb] px-6 pt-28">
      <div className="mx-auto max-w-mobile rounded-[24px] border border-white/40 bg-white/75 p-7 text-center shadow-lg">
        <h1 className="text-xl font-extrabold text-primary">ไม่พบเนื้อหานี้</h1>
        <p className="mt-3 text-sm leading-6 text-[#3e494a]">เนื้อหาอาจถูกซ่อน เก็บถาวร หรือคุณไม่มีสิทธิ์แก้ไข</p>
        <Link href="/community" className="mt-6 inline-flex rounded-full bg-primary px-6 py-3 text-sm font-bold text-white">
          กลับหน้าชุมชน
        </Link>
      </div>
    </div>
  );
}
