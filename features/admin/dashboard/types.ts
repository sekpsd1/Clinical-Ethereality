export type AdminDashboardData = {
  unavailable?: boolean;
  recentActivities: Array<{
    id: string;
    title: string;
    detail: string;
    createdAt: string;
    href: string;
  }>;
  userApprovals: {
    pendingReview: number;
    approvedStaff: number;
    suspended: number;
  };
  operations: {
    pendingConsultations: number;
    paymentsPendingReview: number;
    prescriptionsPendingVerification: number;
    ordersAwaitingPreparation: number;
    lowStockProducts: number;
    moderationQueue: number;
  };
};
