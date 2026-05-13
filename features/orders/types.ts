import type { OrderStatus, PaymentStatus, ShipmentStatus } from "@prisma/client";

export type CustomerOrderTrackingStep = {
  title: string;
  description: string | null;
  status: "done" | "active" | "pending";
};

export type CustomerOrderItem = {
  id: string;
  orderCode: string;
  status: OrderStatus;
  statusLabel: string;
  statusTone: "neutral" | "success" | "warning" | "danger";
  total: string;
  itemSummary: string;
  itemCount: number;
  paymentStatus: PaymentStatus | null;
  paymentLabel: string;
  shipmentStatus: ShipmentStatus | null;
  shipmentLabel: string;
  trackingNumber: string | null;
  createdAt: string;
  updatedAt: string;
  steps: CustomerOrderTrackingStep[];
};

export type CustomerOrdersData = {
  orders: CustomerOrderItem[];
  summary: {
    active: number;
    paymentReview: number;
    completed: number;
  };
  unavailable?: boolean;
};
