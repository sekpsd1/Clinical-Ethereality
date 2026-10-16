/** Customer discovery/booking presentation only; never renames a User or LINE identity. */
export function getCustomerDoctorDisplayName(user: {
  fullName?: string | null;
  displayName?: string | null;
}): string {
  return user.fullName?.trim() || user.displayName?.trim() || "แพทย์ผู้ให้คำปรึกษา";
}
