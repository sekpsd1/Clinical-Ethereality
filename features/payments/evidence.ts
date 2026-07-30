export type PaymentEvidenceInput = {
  qrPayload?: string | null;
  imageUrl?: string | null;
};

export function hasExactlyOnePaymentEvidence(input: PaymentEvidenceInput): boolean {
  const hasQrPayload = Boolean(input.qrPayload?.trim());
  const hasImageUrl = Boolean(input.imageUrl?.trim());

  return hasQrPayload !== hasImageUrl;
}
