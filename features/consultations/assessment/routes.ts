import type { Route } from "next";

function appendDoctorId(path: string, doctorId?: string | null): Route {
  if (!doctorId) {
    return path as Route;
  }

  return `${path}${path.includes("?") ? "&" : "?"}doctorId=${encodeURIComponent(doctorId)}` as Route;
}

export function getAssessmentConsentPath(doctorId?: string | null): Route {
  return appendDoctorId("/consult/assessment", doctorId);
}

export function getAssessmentSymptomsPath(doctorId?: string | null): Route {
  return appendDoctorId("/consult/assessment/symptoms", doctorId);
}

export function getAssessmentDurationPath(symptom?: string | null, doctorId?: string | null): Route {
  const path = symptom
    ? `/consult/assessment/duration?symptom=${encodeURIComponent(symptom)}`
    : "/consult/assessment/duration";

  return appendDoctorId(path, doctorId);
}

export function getAssessmentCompletePath(doctorId?: string | null, assessmentId?: string | null): Route {
  const params = new URLSearchParams();
  if (assessmentId) params.set("assessment", assessmentId);
  if (doctorId) params.set("doctorId", doctorId);

  const query = params.toString();
  return `/consult/assessment/complete${query ? `?${query}` : ""}` as Route;
}

export function getConsultBookingPath(doctorId: string): Route {
  return `/consult/booking/somchai?doctorId=${encodeURIComponent(doctorId)}` as Route;
}

export function getAssessmentSymptomsBackPath(symptom?: string | null, doctorId?: string | null): Route {
  const path = symptom
    ? `/consult/assessment/symptoms?symptom=${encodeURIComponent(symptom)}`
    : "/consult/assessment/symptoms";

  return appendDoctorId(path, doctorId);
}

export function normalizeAssessmentDoctorId(value?: string | null): string | null {
  return value && /^c[a-z0-9]{20,}$/i.test(value) ? value : null;
}
