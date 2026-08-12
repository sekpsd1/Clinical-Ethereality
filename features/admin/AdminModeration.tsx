"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckSquare,
  Eye,
  FileText,
  MessageSquareWarning,
  RotateCcw,
  Search,
  ShieldAlert,
  X
} from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AdminModerationActionButtons } from "@/features/admin/AdminModerationActionButtons";
import {
  defaultAdminModerationFilters,
  filterAdminModerationItems,
  sortAdminModerationItems,
  type AdminModerationFilters,
  type ModerationStatusFilter,
  type ModerationTypeFilter
} from "@/features/admin/moderation/filters";
import { communityReportReasons } from "@/features/community/policy";
import type { AdminModerationData, AdminModerationQueueItem } from "@/features/admin/moderation/types";

const itemTypeLabels = {
  article: "บทความ",
  comment: "ความคิดเห็น"
};

const statusLabels: Record<AdminModerationQueueItem["status"], string> = {
  archived: "เก็บถาวร",
  draft: "ฉบับร่าง",
  hidden: "ซ่อนอยู่",
  published: "เผยแพร่",
  visible: "แสดงอยู่"
};

function getStatusTone(status: AdminModerationQueueItem["status"]): "neutral" | "success" | "warning" | "danger" {
  if (status === "published" || status === "visible") return "success";
  if (status === "hidden") return "warning";
  if (status === "archived") return "danger";
  return "neutral";
}

export function AdminModeration({ data }: { data: AdminModerationData }) {
  const [filters, setFilters] = useState<AdminModerationFilters>(defaultAdminModerationFilters);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [detailItem, setDetailItem] = useState<AdminModerationQueueItem | null>(null);
  const filteredItems = useMemo(
    () => sortAdminModerationItems(filterAdminModerationItems(data.items, filters)),
    [data.items, filters]
  );
  const visibleIds = filteredItems.map(getSelectionId);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

  useEffect(() => {
    if (!detailItem) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDetailItem(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [detailItem]);

  const summaryItems = [
    { label: "รายงานรอตรวจ", value: data.summary.pendingReports, tone: "warning" as const },
    { label: "บทความซ่อน", value: data.summary.hiddenArticles, tone: "warning" as const },
    { label: "ความคิดเห็นซ่อน", value: data.summary.hiddenComments, tone: "danger" as const }
  ];

  return (
    <div className="flex flex-col gap-5">
      <section className="-mx-4 bg-primary-gradient px-4 py-5 text-white shadow-booking lg:mx-0 lg:rounded-[14px] lg:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-label font-bold uppercase text-white/75">ความปลอดภัยชุมชน</p>
            <h2 className="mt-1 font-headline text-2xl font-bold">คิวดูแลชุมชน</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-white/80">
              ตรวจรายงานที่ค้างก่อน แล้วจึงเลือกคงไว้ ซ่อน หรือเก็บถาวรแบบกู้คืนได้
            </p>
          </div>
          <div className="rounded-[8px] border border-white/25 bg-white/15 px-4 py-3 text-right backdrop-blur-sm">
            <p className="text-[11px] font-bold text-white/75">รอตรวจทั้งหมด</p>
            <p className="font-headline text-3xl font-bold tabular-nums">{data.summary.pendingReports}</p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-3 gap-2" aria-label="สรุปคิวดูแลชุมชน">
        {summaryItems.map((item) => (
          <div key={item.label} className="rounded-[8px] border border-border bg-white/85 p-3 shadow-payment-card">
            <p className="font-headline text-2xl font-bold tabular-nums text-text">{item.value}</p>
            <div className="mt-1"><StatusBadge tone={item.tone}>{item.label}</StatusBadge></div>
          </div>
        ))}
      </section>

      <ModerationFilters filters={filters} onChange={setFilters} resultCount={filteredItems.length} />

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-headline text-lg font-bold text-text">รายการเนื้อหา</h2>
            <p className="mt-0.5 text-xs font-semibold text-muted">
              เรียงรายงานรอตรวจก่อน · ค่าเริ่มต้นไม่รวม Test/UAT และรายการเก็บถาวร
            </p>
          </div>
          {data.unavailable ? <StatusBadge tone="danger">ฐานข้อมูลออฟไลน์</StatusBadge> : null}
        </div>

        {!data.unavailable && filteredItems.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-[8px] border border-border bg-white/80 px-3 py-2">
            <label className="inline-flex min-h-9 cursor-pointer items-center gap-2 text-xs font-bold text-text">
              <input
                type="checkbox"
                className="size-4 rounded border-border text-primary"
                checked={allVisibleSelected}
                onChange={(event) => {
                  setSelectedIds((current) => event.currentTarget.checked
                    ? Array.from(new Set([...current, ...visibleIds]))
                    : current.filter((id) => !visibleIds.includes(id)));
                }}
              />
              เลือกรายการที่แสดง
            </label>
            <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-primary/10 px-3 text-[11px] font-bold text-primary">
              <CheckSquare aria-hidden="true" className="size-3.5" /> เลือกแล้ว {selectedIds.length} รายการ · เตรียมไว้สำหรับ Bulk action
            </span>
          </div>
        ) : null}

        {data.unavailable ? (
          <EmptyModerationQueue title="ยังเชื่อมต่อฐานข้อมูลไม่ได้" body="ตั้งค่าฐานข้อมูลก่อนจัดการคิวดูแลชุมชน" />
        ) : data.items.length === 0 ? (
          <EmptyModerationQueue title="ยังไม่มีเนื้อหาที่ต้องตรวจ" body="เมื่อมีรายงานหรือเนื้อหาที่ถูกซ่อน รายการจะปรากฏที่นี่" />
        ) : filteredItems.length === 0 ? (
          <EmptyModerationQueue
            title="ไม่พบรายการที่ตรงกับตัวกรอง"
            body="ลองเปลี่ยนคำค้น ประเภท เหตุผล สถานะ หรือเปิดดู Test/UAT และรายการเก็บถาวร"
            onReset={() => setFilters(defaultAdminModerationFilters)}
          />
        ) : (
          filteredItems.map((item) => (
            <ModerationCard
              key={getSelectionId(item)}
              item={item}
              selected={selectedIds.includes(getSelectionId(item))}
              onSelect={(selected) => setSelectedIds((current) => selected
                ? Array.from(new Set([...current, getSelectionId(item)]))
                : current.filter((id) => id !== getSelectionId(item)))}
              onView={() => setDetailItem(item)}
            />
          ))
        )}
      </section>

      {detailItem ? <ModerationDetailPanel item={detailItem} onClose={() => setDetailItem(null)} /> : null}
    </div>
  );
}

function ModerationFilters({ filters, onChange, resultCount }: {
  filters: AdminModerationFilters;
  onChange: (filters: AdminModerationFilters) => void;
  resultCount: number;
}) {
  const hasCustomFilters = JSON.stringify(filters) !== JSON.stringify(defaultAdminModerationFilters);

  return (
    <section className="rounded-[8px] border border-border bg-white/85 p-3 shadow-payment-card" aria-label="ค้นหาและกรองคิวดูแลชุมชน">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(240px,1.5fr)_1fr_1fr_1fr]">
        <label className="relative sm:col-span-2 xl:col-span-1">
          <span className="sr-only">ค้นหาเนื้อหา</span>
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3 size-4 text-muted" />
          <input
            type="search"
            className="h-10 w-full rounded-[8px] border border-border bg-white pl-9 pr-3 text-sm font-semibold text-text outline-none focus:border-primary"
            placeholder="ค้นหาหัวข้อ เนื้อหา หรือชื่อผู้ใช้"
            value={filters.query}
            onChange={(event) => onChange({ ...filters, query: event.currentTarget.value })}
          />
        </label>
        <FilterSelect
          ariaLabel="กรองประเภทเนื้อหา"
          value={filters.type}
          onChange={(value) => onChange({ ...filters, type: value as ModerationTypeFilter })}
          options={[{ value: "all", label: "ทุกประเภท" }, { value: "article", label: "บทความ" }, { value: "comment", label: "ความคิดเห็น" }]}
        />
        <FilterSelect
          ariaLabel="กรองเหตุผลรายงาน"
          value={filters.reason}
          onChange={(value) => onChange({ ...filters, reason: value })}
          options={[{ value: "all", label: "ทุกเหตุผลรายงาน" }, ...communityReportReasons]}
        />
        <FilterSelect
          ariaLabel="กรองสถานะ"
          value={filters.status}
          onChange={(value) => onChange({ ...filters, status: value as ModerationStatusFilter })}
          options={[
            { value: "all", label: "ทุกสถานะที่แสดง" },
            { value: "pending", label: "รอตรวจ" },
            { value: "published", label: "เผยแพร่" },
            { value: "visible", label: "แสดงอยู่" },
            { value: "draft", label: "ฉบับร่าง" },
            { value: "hidden", label: "ซ่อนอยู่" },
            { value: "archived", label: "เก็บถาวร" }
          ]}
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-3">
        <div className="flex flex-wrap gap-2">
          <FilterCheckbox label="รวม Test/UAT" checked={filters.includeTestItems} onChange={(value) => onChange({ ...filters, includeTestItems: value })} />
          <FilterCheckbox label="รวมรายการเก็บถาวร" checked={filters.includeArchived} onChange={(value) => onChange({ ...filters, includeArchived: value })} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-muted">พบ {resultCount} รายการ</span>
          {hasCustomFilters ? (
            <button type="button" className="inline-flex min-h-9 items-center gap-1.5 rounded-[8px] px-3 text-xs font-bold text-primary hover:bg-primary/5" onClick={() => onChange(defaultAdminModerationFilters)}>
              <RotateCcw aria-hidden="true" className="size-3.5" /> ค่าเริ่มต้น
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function FilterSelect({ ariaLabel, value, onChange, options }: {
  ariaLabel: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <select aria-label={ariaLabel} className="h-10 rounded-[8px] border border-border bg-white px-3 text-xs font-bold text-text outline-none focus:border-primary" value={value} onChange={(event) => onChange(event.currentTarget.value)}>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  );
}

function FilterCheckbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-[8px] bg-surface px-3 text-xs font-bold text-muted">
      <input type="checkbox" className="size-4 rounded border-border text-primary" checked={checked} onChange={(event) => onChange(event.currentTarget.checked)} />
      {label}
    </label>
  );
}

function ModerationCard({ item, selected, onSelect, onView }: {
  item: AdminModerationQueueItem;
  selected: boolean;
  onSelect: (selected: boolean) => void;
  onView: () => void;
}) {
  const Icon = item.type === "article" ? FileText : MessageSquareWarning;
  return (
    <article className="rounded-[8px] border border-border bg-white/90 p-4 shadow-payment-card">
      <div className="flex gap-3">
        <label className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-[8px] bg-surface" title="เลือกรายการ">
          <input type="checkbox" className="size-4 rounded border-border text-primary" checked={selected} onChange={(event) => onSelect(event.currentTarget.checked)} />
        </label>
        <div className="flex size-10 shrink-0 items-center justify-center rounded-[8px] bg-primary/10 text-primary">
          <Icon aria-hidden="true" className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="line-clamp-2 text-sm font-bold text-text">{item.title}</h3>
              <p className="mt-0.5 text-[11px] font-semibold text-muted">{itemTypeLabels[item.type]} · {item.authorName}</p>
            </div>
            <div className="flex flex-wrap gap-1">
              {item.reportId ? <StatusBadge tone="warning">รอตรวจ</StatusBadge> : null}
              <StatusBadge tone={getStatusTone(item.status)}>{statusLabels[item.status]}</StatusBadge>
            </div>
          </div>
          <p className="mt-3 line-clamp-2 text-xs leading-5 text-muted">{item.body}</p>
          {item.reportId ? <p className="mt-2 text-xs font-bold text-warning">เหตุผล: {item.reportReason}</p> : null}
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-3 border-t border-border/70 pt-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="min-w-0 truncate text-[11px] font-semibold text-muted">สร้างเมื่อ {item.createdAt}</p>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="inline-flex min-h-10 items-center gap-1.5 rounded-[8px] bg-primary/10 px-3 text-xs font-bold text-primary" onClick={onView}>
            <Eye aria-hidden="true" className="size-4" /> ดู
          </button>
          <AdminModerationActionButtons item={item} />
        </div>
      </div>
    </article>
  );
}

export function ModerationDetailPanel({ item, onClose }: { item: AdminModerationQueueItem; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[80] flex justify-end bg-text/35 backdrop-blur-[2px]" role="presentation" onMouseDown={onClose}>
      <section aria-labelledby="moderation-detail-title" aria-modal="true" role="dialog" className="h-full w-full overflow-y-auto bg-app shadow-glass sm:max-w-xl" onMouseDown={(event) => event.stopPropagation()}>
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-white/90 px-4 py-3 backdrop-blur-topbar sm:px-5">
          <div className="min-w-0">
            <p className="text-label font-bold uppercase text-primary">รายละเอียดการตรวจสอบ</p>
            <h2 id="moderation-detail-title" className="truncate font-headline text-lg font-bold text-text">{item.title}</h2>
          </div>
          <button type="button" className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-surface text-muted" onClick={onClose} aria-label="ปิดรายละเอียด">
            <X aria-hidden="true" className="size-5" />
          </button>
        </header>
        <div className="space-y-4 p-4 pb-[calc(2rem+env(safe-area-inset-bottom))] sm:p-5">
          <div className="flex flex-wrap gap-2">
            <StatusBadge tone="neutral">{itemTypeLabels[item.type]}</StatusBadge>
            {item.reportId ? <StatusBadge tone="warning">รอตรวจ</StatusBadge> : null}
            <StatusBadge tone={getStatusTone(item.status)}>{statusLabels[item.status]}</StatusBadge>
          </div>
          <section className="rounded-[8px] border border-border bg-white/90 p-4 shadow-payment-card">
            <h3 className="text-sm font-bold text-text">เนื้อหาทั้งหมด</h3>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted">{item.body}</p>
          </section>
          {item.reportId ? (
            <section className="rounded-[8px] border border-warning/30 bg-warning/10 p-4">
              <h3 className="text-sm font-bold text-text">รายงาน</h3>
              <dl className="mt-3 grid gap-3 text-xs leading-5">
                <DetailRow label="เหตุผล" value={item.reportReason ?? "-"} />
                <DetailRow label="รายละเอียด" value={item.reportDetails || "ไม่ได้ระบุ"} />
                <DetailRow label="ผู้รายงาน" value={item.reporterName ?? "-"} />
                <DetailRow label="รายงานเมื่อ" value={item.reportedAt ?? "-"} />
              </dl>
            </section>
          ) : null}
          <section className="rounded-[8px] border border-border bg-white/90 p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-text"><ShieldAlert aria-hidden="true" className="size-4 text-primary" /> เจ้าของเนื้อหา</div>
            <p className="mt-2 text-xs text-muted">{item.authorName} · สร้างเมื่อ {item.createdAt}</p>
          </section>
          <div className="rounded-[8px] border border-danger/20 bg-danger/5 p-3 text-xs leading-5 text-muted">
            “เก็บถาวร” เป็นการซ่อนรายการออกจากคิวเริ่มต้น ไม่ใช่การลบถาวร และสามารถคืนค่าได้
          </div>
          <AdminModerationActionButtons item={item} />
        </div>
      </section>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return <div><dt className="font-bold text-text">{label}</dt><dd className="mt-0.5 text-muted">{value}</dd></div>;
}

function EmptyModerationQueue({ title, body, onReset }: { title: string; body: string; onReset?: () => void }) {
  return (
    <div className="rounded-[8px] border border-dashed border-border bg-white/65 p-5 text-center">
      <h3 className="text-sm font-bold text-text">{title}</h3>
      <p className="mt-2 text-xs leading-5 text-muted">{body}</p>
      {onReset ? <button type="button" className="mt-3 text-xs font-bold text-primary" onClick={onReset}>ล้างตัวกรอง</button> : null}
    </div>
  );
}

function getSelectionId(item: Pick<AdminModerationQueueItem, "id" | "reportId" | "type">): string {
  return `${item.type}:${item.id}:${item.reportId ?? "record"}`;
}
