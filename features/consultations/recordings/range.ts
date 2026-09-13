type RecordingRangeResult =
  | { kind: "none" }
  | { kind: "valid"; value: string }
  | { kind: "invalid" };

export function parseRecordingRangeHeader(
  value: string | null,
  fileType: string,
  fileSizeBytes: bigint | null
): RecordingRangeResult {
  if (!value) return { kind: "none" };
  if (!/^(mp4|m4a)$/i.test(fileType) || value.length > 128 || value.includes(",")) {
    return { kind: "invalid" };
  }

  const match = /^bytes=(\d*)-(\d*)$/i.exec(value.trim());
  if (!match || (!match[1] && !match[2])) return { kind: "invalid" };

  try {
    const start = match[1] ? BigInt(match[1]) : null;
    const end = match[2] ? BigInt(match[2]) : null;
    if ((start !== null && end !== null && start > end) || (start === null && end === BigInt(0))) {
      return { kind: "invalid" };
    }
    if (fileSizeBytes !== null && fileSizeBytes >= BigInt(0)) {
      if (fileSizeBytes === BigInt(0) || (start !== null && start >= fileSizeBytes)) {
        return { kind: "invalid" };
      }
    }
    return { kind: "valid", value: `bytes=${match[1]}-${match[2]}` };
  } catch {
    return { kind: "invalid" };
  }
}
