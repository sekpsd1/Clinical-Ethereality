export const paymentSlipMimeTypes = ["image/jpeg", "image/png", "image/webp"] as const;
export type PaymentSlipMimeType = (typeof paymentSlipMimeTypes)[number];
export const paymentSlipMaxBytes = 5 * 1024 * 1024;
