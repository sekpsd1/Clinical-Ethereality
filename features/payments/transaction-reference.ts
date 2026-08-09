const transactionReferenceFormatting = /[\s\-_.\/:\\]+/gu;
const normalizedTransactionReferencePattern = /^[A-Z0-9]+$/;
const MAX_NORMALIZED_TRANSACTION_REFERENCE_LENGTH = 191;

export class InvalidPaymentTransactionReferenceError extends Error {
  constructor() {
    super("A bank transaction reference must contain only letters and numbers after normalization.");
    this.name = "InvalidPaymentTransactionReferenceError";
  }
}

/**
 * Canonicalizes bank references before they are persisted or compared.
 *
 * NFKC folds compatible full-width characters, uppercasing removes case
 * differences, and whitespace/common separators are formatting-only. The
 * resulting ASCII token is deliberately strict so MySQL's collation cannot
 * create a second equivalence rule that differs from application behavior.
 */
export function normalizePaymentTransactionReference(value: string): string {
  const normalized = value
    .normalize("NFKC")
    .trim()
    .toLocaleUpperCase("en-US")
    .replace(transactionReferenceFormatting, "");

  if (
    !normalized ||
    normalized.length > MAX_NORMALIZED_TRANSACTION_REFERENCE_LENGTH ||
    !normalizedTransactionReferencePattern.test(normalized)
  ) {
    throw new InvalidPaymentTransactionReferenceError();
  }

  return normalized;
}

export const paymentTransactionReferenceConstraints = {
  maxLength: MAX_NORMALIZED_TRANSACTION_REFERENCE_LENGTH
} as const;
