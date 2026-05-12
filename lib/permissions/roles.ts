export const roles = ["customer", "doctor", "pharmacist", "admin"] as const;

export type Role = (typeof roles)[number];
