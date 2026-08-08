export type PrescriptionOrderProduct = {
  id: string;
  name: string;
  slug: string;
  description: string;
  priceLabel: string;
  stockLabel: string;
  availableQuantity: number;
  prescribedQuantity: number;
};

export type PrescriptionOrderDetail = {
  id: string;
  statusLabel: string;
  doctorName: string;
  pharmacistName: string | null;
  verifiedAt: string | null;
  notes: string;
  medicationSummary: string | null;
  linkedOrderCode: string | null;
  products: PrescriptionOrderProduct[];
  isProductMappingComplete: boolean;
};

export type PrescriptionOrderData = {
  prescription: PrescriptionOrderDetail | null;
  unavailable?: boolean;
};
