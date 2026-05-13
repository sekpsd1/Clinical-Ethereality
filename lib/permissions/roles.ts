export const roles = ["customer", "doctor", "pharmacist", "admin"] as const;

export type Role = (typeof roles)[number];

export const roleLabels: Record<Role, string> = {
  customer: "Customer",
  doctor: "Doctor",
  pharmacist: "Pharmacist",
  admin: "Admin"
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && roles.includes(value as Role);
}
