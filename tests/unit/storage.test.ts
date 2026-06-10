import { describe, expect, it } from "vitest";
import { envSchema } from "@/lib/env/schema";
import { normalizeHostedAttachmentInput } from "@/lib/storage/attachments";
import { getStorageReadiness } from "@/lib/storage/provider";

function buildEnv(overrides: Record<string, string | undefined> = {}) {
  return envSchema.parse({
    ...overrides
  });
}

describe("file storage foundation", () => {
  it("treats unconfigured storage as owner-managed hosted URL mode", () => {
    const readiness = getStorageReadiness(buildEnv());
    const attachment = normalizeHostedAttachmentInput(
      {
        storageUrl: "https://storage.example/prescriptions/rx-1.pdf",
        fileName: "rx-1.pdf",
        mimeType: "application/pdf"
      },
      readiness
    );

    expect(readiness.provider).toBe("not_configured");
    expect(readiness.isConfigured).toBe(false);
    expect(readiness.canAcceptHostedUrl).toBe(true);
    expect(attachment).toMatchObject({
      storageUrl: "https://storage.example/prescriptions/rx-1.pdf",
      storageKey: "prescriptions/rx-1.pdf",
      fileName: "rx-1.pdf",
      mimeType: "application/pdf",
      storageProvider: "not_configured",
      storageConfigured: false
    });
  });

  it("extracts storage keys from configured S3 public base URLs", () => {
    const readiness = getStorageReadiness(
      buildEnv({
        S3_BUCKET: "clinical-files",
        S3_ACCESS_KEY_ID: "access-key",
        S3_SECRET_ACCESS_KEY: "secret-key",
        S3_REGION: "ap-southeast-1",
        S3_PUBLIC_BASE_URL: "https://cdn.example.com/clinical"
      })
    );
    const attachment = normalizeHostedAttachmentInput(
      {
        storageUrl: "https://cdn.example.com/clinical/slips/payment-1.png"
      },
      readiness
    );

    expect(readiness.provider).toBe("s3");
    expect(readiness.isConfigured).toBe(true);
    expect(attachment.storageKey).toBe("slips/payment-1.png");
    expect(attachment.fileName).toBe("payment-1.png");
  });

  it("rejects hosted URLs outside the configured storage base URL", () => {
    const readiness = getStorageReadiness(
      buildEnv({
        CLOUDINARY_CLOUD_NAME: "clinic-cloud",
        CLOUDINARY_API_KEY: "api-key",
        CLOUDINARY_API_SECRET: "api-secret"
      })
    );

    expect(readiness.provider).toBe("cloudinary");
    expect(() =>
      normalizeHostedAttachmentInput(
        {
          storageUrl: "https://example.com/not-cloudinary/rx.pdf",
          fileName: "rx.pdf"
        },
        readiness
      )
    ).toThrow(/outside the configured storage base URL/);
  });
});
