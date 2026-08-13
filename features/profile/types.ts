export type ProfileScreen = "user-profile";

export type CustomerProfileData = {
  displayName: string;
  avatarUrl: string | null;
  email: string | null;
  phone: string | null;
  phoneVerifiedAt: string | null;
  memberStatus: string;
  adviceCount: number;
  postCount: number;
  unavailable?: boolean;
};
