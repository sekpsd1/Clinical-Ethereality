"use client";

import {
  calculateCommunityImageDimensions,
  communityImagePolicy
} from "@/features/community/images/policy";

type DecodedImage = {
  source: CanvasImageSource;
  width: number;
  height: number;
  close: () => void;
};

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("ไม่สามารถบีบอัดรูปนี้ได้"));
        }
      },
      "image/webp",
      quality
    );
  });
}

async function decodeImage(file: File): Promise<DecodedImage> {
  if ("createImageBitmap" in window) {
    const bitmap = await createImageBitmap(file);

    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      close: () => bitmap.close()
    };
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("ไม่สามารถอ่านรูปนี้ได้"));
      element.src = objectUrl;
    });

    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      close: () => URL.revokeObjectURL(objectUrl)
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

export async function compressCommunityImage(file: File): Promise<File> {
  if (!communityImagePolicy.acceptedMimeTypes.includes(file.type as (typeof communityImagePolicy.acceptedMimeTypes)[number])) {
    throw new Error("รองรับเฉพาะรูป JPG, PNG หรือ WebP");
  }

  if (file.size === 0 || file.size > communityImagePolicy.maxOriginalBytes) {
    throw new Error("รูปต้นฉบับต้องมีขนาดไม่เกิน 5 MB");
  }

  const decoded = await decodeImage(file);

  try {
    let dimensions = calculateCommunityImageDimensions(decoded.width, decoded.height);
    let quality = 0.8;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const canvas = document.createElement("canvas");
      canvas.width = dimensions.width;
      canvas.height = dimensions.height;
      const context = canvas.getContext("2d", { alpha: true });

      if (!context) {
        throw new Error("อุปกรณ์นี้ไม่รองรับการบีบอัดรูป");
      }

      context.drawImage(decoded.source, 0, 0, dimensions.width, dimensions.height);
      const blob = await canvasToBlob(canvas, quality);

      if (blob.size <= communityImagePolicy.maxStoredBytes) {
        const baseName = file.name.replace(/\.[^.]+$/, "").slice(0, 100) || "community-image";
        return new File([blob], `${baseName}.webp`, {
          type: "image/webp",
          lastModified: Date.now()
        });
      }

      dimensions = calculateCommunityImageDimensions(
        Math.round(dimensions.width * 0.85),
        Math.round(dimensions.height * 0.85)
      );
      quality = Math.max(0.58, quality - 0.06);
    }

    throw new Error("รูปยังมีขนาดใหญ่เกิน 1.5 MB กรุณาเลือกรูปอื่น");
  } finally {
    decoded.close();
  }
}
