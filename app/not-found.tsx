import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

export default function NotFound() {
  return (
    <main className="min-h-dvh bg-app px-6 py-24 text-text">
      <div className="mx-auto max-w-mobile">
        <EmptyState
          title="ข้อมูลนี้ถูกลบหรือไม่มีอยู่แล้ว"
          body="รายการนี้อาจถูกลบ หรือคุณไม่มีสิทธิ์เข้าถึง กรุณากลับไปหน้าหลักแล้วเลือกรายการใหม่"
          icon={<FileQuestion aria-hidden="true" className="size-5" />}
          action={
            <Link
              href="/"
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-6 text-sm font-bold text-white"
            >
              กลับหน้าหลัก
            </Link>
          }
          className="border-solid bg-white/75 px-6 py-8 shadow-bio-card"
        />
      </div>
    </main>
  );
}
