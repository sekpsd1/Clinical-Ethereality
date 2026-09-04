"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AdminDateScheduleDeleteButton } from "@/features/admin/AdminDateScheduleDeleteButton";
import { AdminDateScheduleToggleButton } from "@/features/admin/AdminDateScheduleToggleButton";
import { AdminScheduleToggleButton } from "@/features/admin/AdminScheduleToggleButton";
import type { AdminDoctorAvailabilityDateOverride, AdminDoctorAvailabilitySlot } from "@/features/admin/schedules/types";

const pageSize = 10;

export function AdminScheduleCrudWorkspace({ slots, overrides }: { slots: AdminDoctorAvailabilitySlot[]; overrides: AdminDoctorAvailabilityDateOverride[] }) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"all" | "recurring" | "daily">("all");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [page, setPage] = useState(0);
  const normalizedQuery = query.trim().toLocaleLowerCase("th-TH");
  const rows = useMemo(() => {
    const recurring = slots.map((slot) => ({ kind: "recurring" as const, id: slot.id, doctor: slot.doctorName, isActive: slot.isActive, summary: `ทุก${slot.weekdayLabel} • ${slot.timeRange}`, detail: slot.effectiveRangeLabel, slot }));
    const daily = overrides.map((override) => ({ kind: "daily" as const, id: override.id, doctor: override.doctorName, isActive: override.isActive, summary: override.scheduleDate, detail: override.type === "closed" ? "ปิดทั้งวัน" : `เพิ่มเวลาเฉพาะวัน • ${override.timeRange}`, override }));
    return [...recurring, ...daily].filter((row) =>
      (kind === "all" || row.kind === kind) &&
      (status === "all" || (status === "active" ? row.isActive : !row.isActive)) &&
      (!normalizedQuery || `${row.doctor} ${row.summary} ${row.detail}`.toLocaleLowerCase("th-TH").includes(normalizedQuery))
    );
  }, [kind, normalizedQuery, overrides, slots, status]);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const visibleRows = rows.slice(safePage * pageSize, safePage * pageSize + pageSize);

  function updateFilter(update: () => void) { update(); setPage(0); }

  return <section className="rounded-[8px] border border-border bg-white/85 p-4 shadow-payment-card">
    <div className="flex items-start justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">จัดการข้อมูล</p><h2 className="mt-1 font-headline text-lg font-bold text-text">ตารางแพทย์ทั้งหมด</h2><p className="mt-1 text-xs leading-5 text-muted">ค้นหา กรอง และจัดการตารางจำนวนมาก โดยไม่ต้องเลื่อนหารายการ</p></div><StatusBadge tone="neutral">{rows.length} รายการ</StatusBadge></div>
    <div className="mt-4 grid gap-2 sm:grid-cols-3"><label className="flex h-10 items-center gap-2 rounded-[8px] border border-border bg-white px-3"><Search aria-hidden="true" className="size-4 text-muted" /><input value={query} onChange={(event) => updateFilter(() => setQuery(event.target.value))} placeholder="ค้นหาแพทย์ วัน หรือเวลา" className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-text outline-none" /></label><select value={kind} onChange={(event) => updateFilter(() => setKind(event.target.value as typeof kind))} className="h-10 rounded-[8px] border border-border bg-white px-3 text-sm font-semibold text-text"><option value="all">ทุกประเภท</option><option value="recurring">ตารางประจำ</option><option value="daily">ตารางรายวัน</option></select><select value={status} onChange={(event) => updateFilter(() => setStatus(event.target.value as typeof status))} className="h-10 rounded-[8px] border border-border bg-white px-3 text-sm font-semibold text-text"><option value="all">ทุกสถานะ</option><option value="active">เปิดใช้งาน</option><option value="inactive">ปิดใช้งาน</option></select></div>
    <div className="mt-4 divide-y divide-border/70 rounded-[8px] border border-border bg-white">{visibleRows.length === 0 ? <p className="p-5 text-center text-xs font-semibold text-muted">ไม่พบตารางที่ตรงกับตัวกรอง</p> : visibleRows.map((row) => <article key={`${row.kind}:${row.id}`} className="flex items-center gap-3 p-3"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-bold text-text">{row.doctor}</p><StatusBadge tone={row.kind === "daily" ? "warning" : "neutral"}>{row.kind === "daily" ? "รายวัน" : "ประจำ"}</StatusBadge><StatusBadge tone={row.isActive ? "success" : "neutral"}>{row.isActive ? "เปิดอยู่" : "ปิดไว้"}</StatusBadge></div><p className="mt-1 text-xs font-semibold text-text">{row.summary}</p><p className="mt-1 text-[11px] font-semibold text-muted">{row.detail}</p></div><div className="flex shrink-0 gap-2">{row.kind === "recurring" ? <><Link href={`/admin/schedules?edit=${encodeURIComponent(row.id)}#schedule-form`} className="inline-flex min-h-9 items-center rounded-[8px] border border-border px-3 text-xs font-bold text-primary">แก้ไข</Link><AdminScheduleToggleButton availabilityId={row.id} isActive={row.isActive} /></> : <><AdminDateScheduleDeleteButton overrideId={row.id} /><AdminDateScheduleToggleButton overrideId={row.id} isActive={row.isActive} /></>}</div></article>)}</div>
    <div className="mt-3 flex items-center justify-between text-xs font-semibold text-muted"><span>หน้า {safePage + 1} / {totalPages}</span><div className="flex gap-1"><button type="button" disabled={safePage === 0} onClick={() => setPage(safePage - 1)} className="rounded-[8px] border border-border p-2 disabled:opacity-40"><ChevronLeft className="size-3.5" /></button><button type="button" disabled={safePage >= totalPages - 1} onClick={() => setPage(safePage + 1)} className="rounded-[8px] border border-border p-2 disabled:opacity-40"><ChevronRight className="size-3.5" /></button></div></div>
  </section>;
}
