import type { OrderStatus, PaymentStatus, ShipmentStatus } from "@prisma/client";

export type PharmacistOrderQueueItem = {
  id: string;
  orderCode: string;
  customerName: string;
  customerLineId: string;
  status: OrderStatus;
  total: string;
  itemSummary: string;
  paymentStatus: PaymentStatus | "no_payment_record";
  shipmentStatus: ShipmentStatus | null;
  trackingNumber: string | null;
  createdAt: string;
};

export type PharmacistOrdersData = {
  orders: PharmacistOrderQueueItem[];
  summary: {
    needsPreparation: number;
    inPreparation: number;
    shipped: number;
  };
  unavailable?: boolean;
};
