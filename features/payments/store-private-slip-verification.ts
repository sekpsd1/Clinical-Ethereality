import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { verifyPaymentSlip } from "@/lib/payments/slip-verification";
import {
  applyProviderPaymentVerification,
  type ProviderPaymentSnapshot
} from "@/features/payments/service";
import {
  readPrivatePaymentSlip,
  validatePaymentSlipContent
} from "@/features/payments/private-slips";
import type { PaymentSlipMimeType } from "@/features/payments/private-slip-policy";

export type StorePrivateSlipVerificationOutcome = {
  status: "pending_review" | "rejected" | "verified";
  verification: "manual_review_required" | "provider_rejected" | "provider_verified";
};

type StorePrivateSlipVerificationInput = {
  actorId: string;
  payment: ProviderPaymentSnapshot;
  privateSlip: {
    fileName: string;
    mimeType: PaymentSlipMimeType;
    storageKey: string;
  };
};

const manualReviewFallback: StorePrivateSlipVerificationOutcome = {
  status: "pending_review",
  verification: "manual_review_required"
};

export async function verifyUploadedStorePrivateSlip(
  input: StorePrivateSlipVerificationInput
): Promise<StorePrivateSlipVerificationOutcome> {
  let bytes: Uint8Array;

  try {
    bytes = await readPrivatePaymentSlip(input.privateSlip.storageKey);
    validatePaymentSlipContent(input.privateSlip.mimeType, bytes);
  } catch {
    return manualReviewFallback;
  }

  const result = await verifyPaymentSlip({
    amount: Number(input.payment.amount),
    privateFile: {
      bytes,
      fileName: input.privateSlip.fileName,
      mimeType: input.privateSlip.mimeType
    }
  }).catch(() => null);

  if (!result || result.status === "provider_error") {
    return manualReviewFallback;
  }

  try {
    await prisma.$transaction(
      (tx) =>
        applyProviderPaymentVerification(tx, {
          actorId: input.actorId,
          payment: input.payment,
          result,
          source: "private_file"
        }),
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable
      }
    );
  } catch {
    // The uploaded evidence remains private and pending for an Admin fallback.
    // Do not expose provider or persistence details to the customer response.
    return manualReviewFallback;
  }

  return result.ok
    ? { status: "verified", verification: "provider_verified" }
    : { status: "rejected", verification: "provider_rejected" };
}
