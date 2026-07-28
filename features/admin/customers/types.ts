import type { AccountStatus, ConsultationStatus } from "@prisma/client";
import type { AdminCustomerJourneyTone } from "@/features/admin/customers/status";

export type AdminCustomerAssessment = {
  id: string;
  symptomLabel: string;
  durationLabel: string;
  recommendationTopic: string;
  recommendationSpecialty: string;
  recommendationReason: string;
  completedAt: string;
  expiresAt: string;
  isActive: boolean;
  linkedConsultationId: string | null;
};

export type AdminCustomerConsultation = {
  id: string;
  status: ConsultationStatus;
  statusLabel: string;
  paymentLabel: string;
  tone: AdminCustomerJourneyTone;
  doctorName: string;
  doctorSpecialty: string;
  scheduledAt: string | null;
  createdAt: string;
  assessmentId: string | null;
};

export type AdminCustomerListItem = {
  id: string;
  name: string;
  reference: string;
  accountStatus: AccountStatus;
  latestAssessment: AdminCustomerAssessment | null;
  assessmentStatusLabel: string;
  journeyLabel: string;
  journeyTone: AdminCustomerJourneyTone;
  latestConsultation: AdminCustomerConsultation | null;
  bookedConsultation: AdminCustomerConsultation | null;
  recommendedDoctorName: string | null;
  consultationCount: number;
  assessmentCount: number;
  orderCount: number;
  updatedAt: string;
};

export type AdminCustomersData = {
  customers: AdminCustomerListItem[];
  summary: {
    total: number;
    activeAssessments: number;
    awaitingBooking: number;
    booked: number;
  };
  unavailable?: boolean;
};

export type AdminCustomerDetail = {
  id: string;
  name: string;
  reference: string;
  email: string | null;
  phone: string | null;
  accountStatus: AccountStatus;
  rewardBalance: number;
  createdAt: string;
  lastLoginAt: string | null;
  recommendedDoctorName: string | null;
  assessments: AdminCustomerAssessment[];
  consultations: AdminCustomerConsultation[];
  orderCount: number;
};

export type AdminCustomerDetailData = {
  customer: AdminCustomerDetail | null;
  unavailable?: boolean;
};
