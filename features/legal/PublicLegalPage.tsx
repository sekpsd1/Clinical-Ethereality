import Link from "next/link";
import type { Route } from "next";
import { ArrowLeft, Mail, Phone, ShieldCheck } from "lucide-react";
import { CANONICAL_APP_URL, clinicController } from "@/features/legal/public-documents";

export function PublicLegalPage({
  eyebrow,
  title,
  intro,
  children
}: {
  eyebrow: string;
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-dvh bg-app px-4 py-8 text-[#191c1e]">
      <div className="mx-auto w-full max-w-3xl">
        <Link href={CANONICAL_APP_URL} className="inline-flex items-center gap-2 text-sm font-bold text-primary">
          <ArrowLeft aria-hidden="true" className="size-4" /> กลับหน้าหลัก
        </Link>

        <article className="mt-6 rounded-[28px] border border-white/50 bg-white/70 p-6 shadow-booking backdrop-blur-topbar sm:p-10">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary text-white">
            <ShieldCheck aria-hidden="true" className="size-6" />
          </div>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.14em] text-primary">{eyebrow}</p>
          <h1 className="mt-2 text-3xl font-extrabold leading-tight text-primary">{title}</h1>
          <p className="mt-4 text-base leading-7 text-[#3e494a]">{intro}</p>
          <div className="mt-8 space-y-7 text-sm leading-7 text-[#3e494a]">{children}</div>
        </article>

        <footer className="mt-6 rounded-[24px] border border-white/50 bg-white/70 p-6 text-sm leading-6 text-[#3e494a]">
          <p className="font-extrabold text-[#191c1e]">{clinicController.name}</p>
          <p className="mt-2">{clinicController.address}</p>
          <div className="mt-4 flex flex-col gap-2">
            <a href={`mailto:${clinicController.email}`} className="inline-flex items-center gap-2 font-bold text-primary">
              <Mail aria-hidden="true" className="size-4" /> {clinicController.email}
            </a>
            {clinicController.phones.map((phone) => (
              <a key={phone} href={`tel:${phone.replaceAll("-", "")}`} className="inline-flex items-center gap-2 font-bold text-primary">
                <Phone aria-hidden="true" className="size-4" /> {phone}
              </a>
            ))}
          </div>
          <nav className="mt-5 flex flex-wrap gap-x-5 gap-y-2 border-t border-[#bdc9ca]/30 pt-4">
            <Link href={"/privacy-policy" as Route} className="font-bold text-primary">นโยบายความเป็นส่วนตัว</Link>
            <Link href={"/telemedicine-consent" as Route} className="font-bold text-primary">ความยินยอม Telemedicine</Link>
            <Link href={"/contact" as Route} className="font-bold text-primary">ติดต่อเรา</Link>
          </nav>
        </footer>
      </div>
    </main>
  );
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-extrabold text-[#191c1e]">{title}</h2>
      <div className="mt-2 space-y-3">{children}</div>
    </section>
  );
}
