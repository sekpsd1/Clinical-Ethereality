export type ProfileScreen = "user-profile";

export type CustomerProfileData = {
  displayName: string;
  fullName: string | null;
  dateOfBirth: string | null;
  avatarUrl: string | null;
  email: string | null;
  phone: string | null;
  phoneVerifiedAt: string | null;
  memberStatus: string;
  adviceCount: number;
  postCount: number;
  unavailable?: boolean;
};

const thaiBuddhistDateFormatter = new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC"
});

export function formatCustomerDateOfBirth(value: string | null): string {
  if (!value) return "ยังไม่ได้ระบุ";

  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? "ยังไม่ได้ระบุ" : thaiBuddhistDateFormatter.format(date);
}
