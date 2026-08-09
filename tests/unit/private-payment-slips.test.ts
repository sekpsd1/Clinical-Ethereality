import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  PaymentSlipError,
  preparePrivatePaymentSlip,
  readPrivatePaymentSlip,
  resolvePaymentSlipPath,
  validatePaymentSlipContent
} from "@/features/payments/private-slips";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  delete process.env.PAYMENT_UPLOAD_DIR;
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function useTemporaryPaymentUploadRoot() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "payment-slip-"));
  temporaryDirectories.push(directory);
  process.env.PAYMENT_UPLOAD_DIR = directory;
}

describe("private payment slip storage", () => {
  it("stores an image below the configured private root and returns only an authenticated route", async () => {
    await useTemporaryPaymentUploadRoot();
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    const prepared = await preparePrivatePaymentSlip({
      file: new File([bytes], "receipt.png", { type: "image/png" }),
      ownerId: "customer-1",
      paymentId: "payment-1"
    });

    expect(prepared.storageUrl).toBe(`/api/payments/slips/${prepared.attachmentId}`);
    expect(prepared.storageKey).toMatch(/^payments\/[a-f0-9]{24}\/[a-f0-9]{24}\/[a-f0-9-]+\.png$/);
    expect(resolvePaymentSlipPath(prepared.storageKey)).toContain(process.env.PAYMENT_UPLOAD_DIR!);
    await expect(readPrivatePaymentSlip(prepared.storageKey)).resolves.toEqual(bytes);
  });

  it("rejects an allowed MIME type whose file signature is not an image", async () => {
    await useTemporaryPaymentUploadRoot();
    await expect(
      preparePrivatePaymentSlip({
        file: new File(["not a png"], "receipt.png", { type: "image/png" }),
        ownerId: "customer-1",
        paymentId: "payment-1"
      })
    ).rejects.toMatchObject({ code: "FILE_CONTENT_INVALID" } satisfies Partial<PaymentSlipError>);
  });

  it("rejects unsupported content types and path traversal reads", async () => {
    await useTemporaryPaymentUploadRoot();
    await expect(
      preparePrivatePaymentSlip({
        file: new File(["plain text"], "receipt.txt", { type: "text/plain" }),
        ownerId: "customer-1",
        paymentId: "payment-1"
      })
    ).rejects.toMatchObject({ code: "FILE_TYPE_NOT_ALLOWED" });
    expect(() => resolvePaymentSlipPath("../outside.png")).toThrow(PaymentSlipError);
    expect(() => validatePaymentSlipContent("image/jpeg", new Uint8Array([0x89, 0x50, 0x4e]))).toThrow(PaymentSlipError);
  });
});
