export type PaymentEvidenceInput = {
  attachmentId?: string | null;
  qrPayload?: string | null;
  imageUrl?: string | null;
};

export function hasExactlyOnePaymentEvidence(input: PaymentEvidenceInput): boolean {
  const hasAttachment = Boolean(input.attachmentId?.trim());
  const hasQrPayload = Boolean(input.qrPayload?.trim());
  const hasImageUrl = Boolean(input.imageUrl?.trim());

  return Number(hasAttachment) + Number(hasQrPayload) + Number(hasImageUrl) === 1;
}
