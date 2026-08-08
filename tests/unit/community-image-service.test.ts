import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterEach, describe, expect, it } from "vitest";
import {
  prepareCommunityImage,
  resolveCommunityImagePath
} from "@/features/community/images/service";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  delete process.env.COMMUNITY_UPLOAD_DIR;
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true })
    )
  );
});

describe("community image server processing", () => {
  it("resizes, converts to WebP, and strips input EXIF metadata", async () => {
    const uploadRoot = await mkdtemp(path.join(os.tmpdir(), "community-image-"));
    temporaryDirectories.push(uploadRoot);
    process.env.COMMUNITY_UPLOAD_DIR = uploadRoot;

    const original = await sharp({
      create: {
        width: 2400,
        height: 1800,
        channels: 3,
        background: "#27a49b"
      }
    })
      .jpeg({ quality: 95 })
      .withExif({
        IFD0: {
          Copyright: "must-be-removed"
        }
      })
      .toBuffer();
    const originalArrayBuffer = original.buffer.slice(
      original.byteOffset,
      original.byteOffset + original.byteLength
    ) as ArrayBuffer;
    const file = new File([originalArrayBuffer], "camera.jpg", {
      type: "image/jpeg"
    });

    const prepared = await prepareCommunityImage({
      file,
      ownerId: "customer-1",
      articleId: "article-1"
    });
    const stored = await readFile(resolveCommunityImagePath(prepared.storageKey));
    const metadata = await sharp(stored).metadata();

    expect(prepared.storageUrl).toBe(`/api/community/images/${prepared.attachmentId}`);
    expect(prepared.byteSize).toBeLessThanOrEqual(1_500_000);
    expect(metadata.format).toBe("webp");
    expect(Math.max(metadata.width ?? 0, metadata.height ?? 0)).toBeLessThanOrEqual(1600);
    expect(metadata.exif).toBeUndefined();
  });

  it("rejects a file whose declared type is not allowed", async () => {
    const uploadRoot = await mkdtemp(path.join(os.tmpdir(), "community-image-"));
    temporaryDirectories.push(uploadRoot);
    process.env.COMMUNITY_UPLOAD_DIR = uploadRoot;

    await expect(
      prepareCommunityImage({
        file: new File(["not an image"], "notes.txt", { type: "text/plain" }),
        ownerId: "customer-1",
        articleId: "article-1"
      })
    ).rejects.toMatchObject({
      code: "FILE_TYPE_NOT_ALLOWED"
    });
  });

  it("rejects an original image above the 5 MB launch limit", async () => {
    const uploadRoot = await mkdtemp(path.join(os.tmpdir(), "community-image-"));
    temporaryDirectories.push(uploadRoot);
    process.env.COMMUNITY_UPLOAD_DIR = uploadRoot;

    await expect(
      prepareCommunityImage({
        file: new File([new Uint8Array(5 * 1024 * 1024 + 1)], "too-large.jpg", {
          type: "image/jpeg"
        }),
        ownerId: "customer-1",
        articleId: "article-1"
      })
    ).rejects.toMatchObject({
      code: "FILE_TOO_LARGE"
    });
  });
});
