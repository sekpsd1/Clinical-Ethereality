export function getDoctorPatientReference(lineUserId: string): string {
  const suffix = lineUserId.slice(-6).toUpperCase();

  return `รหัสผู้ป่วย ${suffix || "ไม่ระบุ"}`;
}
