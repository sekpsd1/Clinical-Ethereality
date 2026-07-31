import type { OrderStatus, ShipmentStatus } from "@prisma/client";
import type { OrderShippingAddressView } from "@/features/profile/shipping-addresses/types";

export type AdminOrderFulfillmentHistoryItem = {
  action: "order.mark_preparing" | "order.mark_shipped" | "order.mark_delivered";
  actorName: string;
  actorRole: string | null;
  occurredAt: string;
};

export type AdminOrderQueueItem = {
  id: string;
  orderCode: string;
  customerName: string;
  customerLineId: string;
  status: OrderStatus;
  total: string;
  itemSummary: string;
  prescriptionDoctorName: string | null;
  prescriptionSummary: string | null;
  externalPrescriptionFileName: string | null;
  externalPrescriptionAttachmentCount: number;
  paymentStatus: string;
  shippingAddress: OrderShippingAddressView | null;
  shipmentId: string | null;
  shipmentStatus: ShipmentStatus | null;
  trackingNumber: string | null;
  createdAt: string;
  fulfillmentHistory: AdminOrderFulfillmentHistoryItem[];
};

export type AdminOrdersData = {
  orders: AdminOrderQueueItem[];
  summary: {
    needsPreparation: number;
    inFulfillment: number;
    shipped: number;
  };
  unavailable?: boolean;
};
