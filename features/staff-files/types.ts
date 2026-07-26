export const staffFileEntityTypes = {
  licenseProof: "staff_license_proof",
  profilePhoto: "staff_profile_photo"
} as const;

export type StaffFileKind = keyof typeof staffFileEntityTypes;

export const staffFileLimits = {
  licenseProof: 10 * 1024 * 1024,
  profilePhoto: 5 * 1024 * 1024
} as const;

export const staffFileAccept = {
  licenseProof: "image/jpeg,image/png,image/webp,application/pdf",
  profilePhoto: "image/jpeg,image/png,image/webp"
} as const;

export const staffFileLabels = {
  licenseProof: "เอกสารใบอนุญาต",
  profilePhoto: "รูปโปรไฟล์ทางการ"
} as const;
