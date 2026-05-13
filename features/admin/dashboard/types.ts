export type AdminDashboardData = {
  unavailable?: boolean;
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
