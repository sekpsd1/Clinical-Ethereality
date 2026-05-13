import { ClipboardList, FileText, UsersRound } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { DoctorPatientLogItem, DoctorPatientsData } from "@/features/doctor/patients/types";

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

function getStatusTone(status: DoctorPatientLogItem["latestConsultationStatus"]): "neutral" | "success" | "warning" | "danger" {
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

export function DoctorPatients({ data }: { data: DoctorPatientsData }) {
  const summaryItems = [
    {
      label: "Patients",
      value: String(data.summary.totalPatients),
      tone: "neutral"
    },
    {
      label: "Active",
      value: String(data.summary.activeConsultations),
      tone: "warning"
    },
    {
      label: "Rx",
      value: String(data.summary.prescriptions),
      tone: "success"
    }
  ] as const;

  return (
    <div className="flex flex-col gap-5">
      <section className="-mx-4 bg-primary-gradient px-4 py-5 text-white shadow-booking">
        <p className="text-label font-bold uppercase text-white/75">Patient Logs</p>
        <h2 className="mt-1 font-headline text-2xl font-bold">Assigned patient history</h2>
        <p className="mt-2 max-w-[340px] text-sm leading-6 text-white/80">
          View patients connected to doctor consultations with recent notes and prescription context.
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
          <h2 className="font-headline text-lg font-bold text-text">Patients</h2>
          <StatusBadge tone={data.unavailable || data.missingDoctorProfile ? "danger" : "success"}>
            {data.unavailable ? "Database offline" : data.missingDoctorProfile ? "Profile needed" : "Ready"}
          </StatusBadge>
        </div>

        {data.unavailable ? (
          <EmptyPatientLogs
            title="Database is not connected"
            body="Set DATABASE_URL and run the Prisma schema before reviewing patient logs."
          />
        ) : data.missingDoctorProfile ? (
          <EmptyPatientLogs title="Doctor profile is missing" body="Approve or create a doctor profile before showing assigned patient logs." />
        ) : data.patients.length === 0 ? (
          <EmptyPatientLogs title="No patient logs yet" body="Patients with assigned consultations will appear here." />
        ) : null}

        {data.patients.map((patient) => {
          const tone = getStatusTone(patient.latestConsultationStatus);

          return (
            <article key={patient.id} className="rounded-[8px] border border-border bg-white/85 p-4 shadow-payment-card">
              <div className="flex gap-3">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-[8px] bg-primary/10 text-primary">
                  <UsersRound aria-hidden="true" className="size-5" strokeWidth={2.1} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-bold text-text">{patient.patientName}</h3>
                      <p className="mt-0.5 truncate text-[11px] font-semibold text-muted">{patient.patientLineId}</p>
                    </div>
                    {patient.latestConsultationStatus ? (
                      <StatusBadge tone={tone}>{consultationStatusLabels[patient.latestConsultationStatus]}</StatusBadge>
                    ) : null}
                  </div>
                  <p className="mt-3 text-xs leading-5 text-muted">
                    {patient.latestSummary ?? "No consultation summary has been recorded yet."}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <InfoTile label="Consults" value={`${patient.consultationCount}`} icon="consult" />
                <InfoTile
                  label="Prescription"
                  value={
                    patient.latestPrescriptionStatus
                      ? `${prescriptionStatusLabels[patient.latestPrescriptionStatus]} (${patient.prescriptionCount})`
                      : "None"
                  }
                  icon="note"
                />
              </div>

              <p className="mt-3 truncate border-t border-border/70 pt-3 text-[11px] font-semibold text-muted">
                Latest visit {patient.latestConsultationAt ?? "not scheduled"}
              </p>
            </article>
          );
        })}
      </section>
    </div>
  );
}

function EmptyPatientLogs({ title, body }: { title: string; body: string }) {
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
