// Browser component tests never import or call real booking/identity mutations.
export async function createConsultationBookingAction() { throw new Error("No booking writes in component preview"); }
export async function reschedulePaidConsultationAction() { throw new Error("No reschedule writes in component preview"); }
export function BookingIdentityVerification() { return null; }
