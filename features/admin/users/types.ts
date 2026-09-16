import type { Role } from "@/lib/permissions/roles";

export type AdminUserApprovalStatus = "active" | "pending_review" | "suspended" | "archived";
export type AdminStaffProfileStatus = "pending_review" | "approved" | "rejected" | "suspended" | "archived";
export type AdminStaffTab = "pending" | "approved" | "inactive";

export type AdminUserApprovalItem = {
  id: string;
  name: string;
  fullName: string | null;
  displayName: string | null;
  lineId: string;
  currentRole: Role;
  requestedRole: Role;
  status: AdminUserApprovalStatus;
  staffStatus?: AdminStaffProfileStatus;
  profile: string;
  profilePhotoUrl: string | null;
  profilePhotoName: string | null;
  licenseProofUrl: string | null;
  licenseProofName: string | null;
  doctorSpecialty: string | null;
  doctorLicenseNumber: string | null;
  doctorBio: string | null;
  submittedAt: string;
};

export type AdminDoctorAccountCandidate = AdminUserApprovalItem;

export type AdminUserApprovalSummary = {
  pendingReview: number;
  approvedStaff: number;
  suspended: number;
};

export type AdminUserApprovalsData = {
  users: AdminUserApprovalItem[];
  summary: AdminUserApprovalSummary;
  filters: {
    status: AdminStaffTab;
    query: string;
    doctorQuery: string;
  };
  doctorCandidates: AdminDoctorAccountCandidate[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  unavailable?: boolean;
};
