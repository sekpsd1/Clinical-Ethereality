import { ClipboardList, FileText, Stethoscope } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DoctorPrescriptionForm } from "@/features/doctor/DoctorPrescriptionForm";
import type { DoctorConsultationItem, DoctorConsultationsData } from "@/features/doctor/consultations/types";

const consultationStatusLabels: Record<string, string> = {
  cancelled: "Cancelled",
  completed: "Completed",
  live: "Live",
  pending_payment: "Payment pending",
  requested: "Requested",
  scheduled: "Scheduled"
};

const prescriptionStatusLabels: Record<string, string> = {
  archived: "Archived",
  dispensed: "Dispensed",
  draft: "Draft",
  pending_verification: "Pending verification",
  rejected: "Rejected",
  verified: "Verified"
};

function getStatusTone(status: DoctorConsultationItem["status"]): "neutral" | "success" | "warning" | "danger" {
  if (status === "completed") {
    return "success";
  }

  if (status === "requested" || status === "pending_payment" || status === "scheduled" || status === "live") {
    return "warning";
  }

  if (status === "cancelled") {
    return "danger";
  }

  return "neutral";
}

function canWritePrescription(consultation: DoctorConsultationItem): boolean {
  if (consultation.status === "cancelled" || consultation.status === "requested" || consultation.status === "pending_payment") {
    return false;
  }

  return consultation.latestPrescriptionStatus !== "pending_verification";
}

export function DoctorConsultations({ data }: { data: DoctorConsultationsData }) {
  const summaryItems = [
    {
      label: "Scheduled",
      value: String(data.summary.scheduled),
      tone: "warning"
    },
    {
      label: "Live",
      value: String(data.summary.live),
      tone: "neutral"
    },
    {
      label: "Completed",
      value: String(data.summary.completed),
      tone: "success"
    }
  ] as const;

  return (
    <div className="flex flex-col gap-5">
      <section className="-mx-4 bg-primary-gradient px-4 py-5 text-white shadow-booking">
        <p className="text-label font-bold uppercase text-white/75">Doctor Operations</p>
        <h2 className="mt-1 font-headline text-2xl font-bold">Consultation queue</h2>
        <p className="mt-2 max-w-[340px] text-sm leading-6 text-white/80">
          Review scheduled and completed consultations with patient context and prescription status.
        </p>
      </section>

      <section className="grid grid-cols-3 gap-2">
        {summaryItems.map((item) => (
          <div key={item.label} className="rounded-[8px] border border-border bg-white/85 p-3 shadow-payment-card">
            <p className="font-headline text-2xl font-bold text-text">{item.value}</p>
            <p className="mt-1 min-h-8 text-[10px] font-semibold leading-4 text-muted">{item.label}</p>
            <div className="mt-2">
              <StatusBadge tone={item.tone}>{item.label}</StatusBadge>
            </div>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-headline text-lg font-bold text-text">Consultations</h2>
          <StatusBadge tone={data.unavailable || data.missingDoctorProfile ? "danger" : "success"}>
            {data.unavailable ? "Database offline" : data.missingDoctorProfile ? "Profile needed" : "Ready"}
          </StatusBadge>
        </div>

        {data.unavailable ? (
          <EmptyDoctorQueue
            title="Database is not connected"
            body="Set DATABASE_URL and run the Prisma schema before reviewing consultations."
          />
        ) : data.missingDoctorProfile ? (
          <EmptyDoctorQueue title="Doctor profile is missing" body="Approve or create a doctor profile before showing assigned consultations." />
        ) : data.consultations.length === 0 ? (
          <EmptyDoctorQueue title="No consultations yet" body="Assigned patient consultations will appear here." />
        ) : null}

        {data.consultations.map((consultation) => {
          const tone = getStatusTone(consultation.status);

          return (
            <article key={consultation.id} className="rounded-[8px] border border-border bg-white/85 p-4 shadow-payment-card">
              <div className="flex gap-3">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-[8px] bg-primary/10 text-primary">
                  <Stethoscope aria-hidden="true" className="size-5" strokeWidth={2.1} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-bold text-text">{consultation.patientName}</h3>
                      <p className="mt-0.5 truncate text-[11px] font-semibold text-muted">{consultation.patientLineId}</p>
                    </div>
                    <StatusBadge tone={tone}>{consultationStatusLabels[consultation.status]}</StatusBadge>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-muted">
                    {consultation.summary ?? "No consultation note has been recorded yet."}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <InfoTile label="Scheduled" value={consultation.scheduledAt ?? "Not scheduled"} icon="consult" />
                <InfoTile
                  label="Prescription"
                  value={
                    consultation.latestPrescriptionStatus
                      ? `${prescriptionStatusLabels[consultation.latestPrescriptionStatus]} (${consultation.prescriptionCount})`
                      : "None"
                  }
                  icon="note"
                />
              </div>

              <p className="mt-3 truncate border-t border-border/70 pt-3 text-[11px] font-semibold text-muted">
                Created {consultation.createdAt}
              </p>

              {canWritePrescription(consultation) ? <DoctorPrescriptionForm consultation={consultation} /> : null}
            </article>
          );
        })}
      </section>
    </div>
  );
}

function EmptyDoctorQueue({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[8px] border border-dashed border-border bg-white/65 p-5 text-center">
      <h3 className="text-sm font-bold text-text">{title}</h3>
      <p className="mt-2 text-xs leading-5 text-muted">{body}</p>
    </div>
  );
}

function InfoTile({ label, value, icon }: { label: string; value: string; icon: "consult" | "note" }) {
  const Icon = icon === "consult" ? ClipboardList : FileText;

  return (
    <div className="rounded-[8px] bg-primary/5 px-3 py-2">
      <div className="flex items-center gap-1.5 text-muted">
        <Icon aria-hidden="true" className="size-3.5" strokeWidth={2.1} />
        <p className="text-[10px] font-bold uppercase">{label}</p>
      </div>
      <p className="mt-0.5 truncate font-bold text-primary">{value}</p>
    </div>
  );
}
