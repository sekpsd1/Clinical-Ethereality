import type { OrderStatus, ShipmentStatus } from "@prisma/client";

export type AdminOrderQueueItem = {
  id: string;
  orderCode: string;
  customerName: string;
  customerLineId: string;
  status: OrderStatus;
  total: string;
  itemSummary: string;
  paymentStatus: string;
  shipmentId: string | null;
  shipmentStatus: ShipmentStatus | null;
  trackingNumber: string | null;
  createdAt: string;
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
