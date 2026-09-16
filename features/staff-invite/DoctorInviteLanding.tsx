"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { CheckCircle2, Clock3, LogIn, ShieldAlert, ShieldCheck } from "lucide-react";
import { LogoutButton } from "@/features/profile/LogoutButton";

type InviteState =
  | "checking"
  | "ready"
  | "login_required"
  | "pending"
  | "approved"
  | "revoked"
  | "wrong_account"
  | "unavailable"
  | "retry";

const rawTokenPattern = /^v1\.[0-9a-f-]{36}\.[A-Za-z0-9_-]{43}$/;

function readAndClearInviteFragment(): string | null {
  const fragment = window.location.hash.slice(1);
  if (window.location.hash) window.history.replaceState(null, "", "/doctor-invite");
  return rawTokenPattern.test(fragment) ? fragment : null;
}

async function readContext(): Promise<InviteState> {
  const response = await fetch("/doctor-invite/api/context", {
    credentials: "same-origin",
    cache: "no-store",
    headers: { Accept: "application/json" }
  });
  const payload = (await response.json().catch(() => null)) as { state?: InviteState } | null;
  return payload?.state ?? "unavailable";
}

export function DoctorInviteLanding() {
  const [state, setState] = useState<InviteState>("checking");
  const [claiming, setClaiming] = useState(false);

  const refresh = useCallback(async () => {
    setState("checking");
    try {
      setState(await readContext());
    } catch {
      setState("retry");
    }
  }, []);

  useEffect(() => {
    let active = true;
    const token = readAndClearInviteFragment();

    async function initialize() {
      try {
        if (token) {
          const response = await fetch("/doctor-invite/api/exchange", {
            method: "POST",
            credentials: "same-origin",
            cache: "no-store",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ token })
          });
          if (!response.ok) {
            if (active) setState("unavailable");
            return;
          }
        }
        const nextState = await readContext();
        if (active) setState(nextState);
      } catch {
        if (active) setState("retry");
      }
    }

    void initialize();
    return () => {
      active = false;
    };
  }, []);

  async function claimInvite() {
    setClaiming(true);
    try {
      const response = await fetch("/doctor-invite/api/claim", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { Accept: "application/json" }
      });
      const payload = (await response.json().catch(() => null)) as { state?: InviteState } | null;
      const nextState = payload?.state ?? "unavailable";
      setState(nextState);
      if (nextState === "pending") window.history.replaceState(null, "", "/doctor-invite/status");
    } catch {
      setState("retry");
    } finally {
      setClaiming(false);
    }
  }

  return (
    <main className="min-h-dvh bg-app px-4 py-[calc(1.5rem+env(safe-area-inset-top))] text-text">
      <section className="mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-mobile flex-col gap-5">
        <header className="rounded-[24px] bg-primary-gradient p-5 text-white shadow-booking">
          <span className="flex size-12 items-center justify-center rounded-full bg-white/15">
            <ShieldCheck aria-hidden="true" className="size-6" strokeWidth={2.1} />
          </span>
          <p className="mt-4 text-label font-bold uppercase text-white/75">คำเชิญแพทย์</p>
          <h1 className="mt-1 font-headline text-2xl font-bold">เชื่อมบัญชี LINE อย่างปลอดภัย</h1>
          <p className="mt-3 text-sm leading-6 text-white/85">
            ลิงก์นี้ใช้ได้ครั้งเดียวเพื่อเชื่อมบัญชีเท่านั้น ข้อมูลวิชาชีพ เอกสาร และการอนุมัติยังคงดำเนินการโดยผู้ดูแลระบบ
          </p>
        </header>

        <InviteStateCard state={state} claiming={claiming} onClaim={claimInvite} onRetry={refresh} />
      </section>
    </main>
  );
}

function InviteStateCard({
  state,
  claiming,
  onClaim,
  onRetry
}: {
  state: InviteState;
  claiming: boolean;
  onClaim: () => void;
  onRetry: () => void;
}) {
  if (state === "checking") {
    return (
      <StatusCard icon={<Clock3 className="size-7" />} title="กำลังตรวจสอบคำเชิญ">
        กรุณารอสักครู่ ระบบกำลังตรวจสอบสถานะลิงก์และบัญชี LINE ของคุณ
      </StatusCard>
    );
  }

  if (state === "login_required") {
    return (
      <StatusCard icon={<LogIn className="size-7" />} title="เข้าสู่ระบบด้วยบัญชีที่จะเชื่อม">
        <p>เปิดลิงก์นี้ผ่าน LINE แล้วเข้าสู่ระบบด้วยบัญชีลูกค้าที่ใช้งานอยู่ คำเชิญจะไม่ถูกส่งต่อใน URL เข้าสู่ระบบ</p>
        <a
          href="/auth/line?next=%2Fdoctor-invite"
          className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-primary px-5 text-sm font-bold text-white shadow-chip"
        >
          เข้าสู่ระบบด้วย LINE
        </a>
      </StatusCard>
    );
  }

  if (state === "ready") {
    return (
      <StatusCard icon={<ShieldCheck className="size-7" />} title="พร้อมเชื่อมบัญชี LINE">
        <p>ยืนยันว่าต้องการใช้บัญชีนี้รับคำเชิญแพทย์ บัญชียังคงเป็นลูกค้าและจะรอผู้ดูแลระบบตรวจสอบหลังเชื่อมสำเร็จ</p>
        <button
          type="button"
          disabled={claiming}
          onClick={onClaim}
          className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-primary px-5 text-sm font-bold text-white shadow-chip disabled:opacity-60"
        >
          {claiming ? "กำลังเชื่อมบัญชี..." : "ยืนยันเชื่อมบัญชี"}
        </button>
      </StatusCard>
    );
  }

  if (state === "pending") {
    return (
      <StatusCard icon={<Clock3 className="size-7" />} title="รอผู้ดูแลระบบตรวจสอบ">
        <p>เชื่อมบัญชีสำเร็จแล้ว ผู้ดูแลระบบจะกรอกข้อมูลวิชาชีพ ตรวจเอกสาร และอนุมัติผ่านขั้นตอนเดิม</p>
        <p className="mt-3 rounded-[8px] bg-primary/5 px-3 py-2 text-xs font-semibold leading-5 text-primary">
          ระหว่างรอ บัญชีนี้ยังเข้าแบบประเมิน การจอง และพื้นที่บุคลากรไม่ได้
        </p>
        <button type="button" onClick={onRetry} className="mt-5 min-h-11 w-full rounded-full border border-primary px-5 text-sm font-bold text-primary">
          ตรวจสอบสถานะอีกครั้ง
        </button>
      </StatusCard>
    );
  }

  if (state === "approved") {
    return (
      <StatusCard icon={<CheckCircle2 className="size-7" />} title="อนุมัติสิทธิ์แพทย์แล้ว">
        <p>ออกจากระบบแล้วเข้าใหม่ผ่าน LINE เพื่อสร้างเซสชันใหม่และเริ่มใช้งานด้วยสิทธิ์แพทย์</p>
        <LogoutButton redirectTo="/auth/line?next=%2Fauth%2Frole-home" className="mt-5 min-h-11 w-full justify-center rounded-full bg-primary px-5 text-white no-underline hover:no-underline" />
      </StatusCard>
    );
  }

  const copy = state === "revoked"
    ? "ผู้ดูแลระบบเพิกถอนคำเชิญนี้แล้ว บัญชีของคุณยังคงเป็นลูกค้า กรุณาติดต่อผู้ดูแลหากต้องการคำเชิญใหม่"
    : state === "wrong_account"
      ? "บัญชีนี้ไม่สามารถรับคำเชิญได้ ต้องเป็นบัญชีลูกค้าที่เปิดใช้งานและยังไม่เป็นบุคลากร กรุณาออกจากระบบแล้วเปิดลิงก์ด้วยบัญชีที่ถูกต้อง"
      : state === "retry"
        ? "การเชื่อมต่อขัดข้องชั่วคราว กรุณาลองตรวจสอบอีกครั้ง"
        : "ลิงก์นี้ไม่พร้อมใช้งาน อาจหมดอายุ ถูกใช้ หรือถูกเพิกถอนแล้ว กรุณาขอลิงก์ใหม่จากผู้ดูแลระบบ";

  return (
    <StatusCard icon={<ShieldAlert className="size-7" />} title="ไม่สามารถใช้คำเชิญนี้ได้" tone="danger">
      <p>{copy}</p>
      {state === "retry" ? (
        <button type="button" onClick={onRetry} className="mt-5 min-h-11 w-full rounded-full border border-primary px-5 text-sm font-bold text-primary">
          ลองอีกครั้ง
        </button>
      ) : null}
      {state === "wrong_account" ? <LogoutButton redirectTo="/auth/line?next=%2Fdoctor-invite" className="mt-5 min-h-11 w-full justify-center" /> : null}
    </StatusCard>
  );
}

function StatusCard({
  icon,
  title,
  tone = "primary",
  children
}: {
  icon: ReactNode;
  title: string;
  tone?: "primary" | "danger";
  children: ReactNode;
}) {
  return (
    <section className="rounded-[8px] border border-border bg-white/90 p-5 text-center shadow-payment-card" aria-live="polite">
      <span className={`mx-auto flex size-14 items-center justify-center rounded-full ${tone === "danger" ? "bg-danger/10 text-danger" : "bg-primary/10 text-primary"}`}>
        {icon}
      </span>
      <h2 className="mt-4 font-headline text-xl font-bold text-text">{title}</h2>
      <div className="mt-2 text-sm leading-6 text-muted">{children}</div>
    </section>
  );
}
