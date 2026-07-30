export const communityImagePolicy = {
  acceptedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  maxOriginalBytes: 5 * 1024 * 1024,
  maxStoredBytes: 1_500_000,
  maxDimension: 1600
} as const;

export function calculateCommunityImageDimensions(
  width: number,
  height: number,
  maxDimension = communityImagePolicy.maxDimension
): { width: number; height: number } {
  if (width <= 0 || height <= 0 || maxDimension <= 0) {
    throw new Error("Invalid image dimensions.");
  }

  const scale = Math.min(1, maxDimension / Math.max(width, height));

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  };
}

export function formatCommunityImageBytes(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
