// Conservative initial ISO BMFF evidence, not a codec decoder or whole-file integrity proof.
export const MP4_PROBE_BYTES = 4096;
const MAJOR_BRANDS = new Set(["isom", "iso2", "avc1", "mp41", "mp42"]);
const MP4_BRANDS = new Set(["mp41", "mp42"]);

export function validateMp4Prefix(bytes: Uint8Array, totalSize: bigint): void {
  if (bytes.length < 24 || bytes.length > MP4_PROBE_BYTES) throw new Error("Invalid MP4 evidence");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const size = view.getUint32(0);
  const fourcc = (offset: number) => String.fromCharCode(...bytes.subarray(offset, offset + 4));
  if (fourcc(4) !== "ftyp" || size < 20 || size > bytes.length || BigInt(size) >= totalSize || (size - 16) % 4 !== 0) {
    throw new Error("Invalid MP4 evidence");
  }
  const major = fourcc(8);
  if (!MAJOR_BRANDS.has(major)) throw new Error("Invalid MP4 evidence");
  let mp4 = MP4_BRANDS.has(major);
  for (let offset = 16; offset < size; offset += 4) {
    const brand = fourcc(offset);
    if (!/^[\x20-\x7e]{4}$/.test(brand)) throw new Error("Invalid MP4 evidence");
    mp4 ||= MP4_BRANDS.has(brand);
  }
  if (!mp4) throw new Error("Invalid MP4 evidence");
}

export function expectedMp4Range(range: string, size: bigint): { value: string; length: bigint } {
  const match = /^bytes=(\d{0,20})-(\d{0,20})$/.exec(range);
  if (!match || (!match[1] && !match[2]) || size <= BigInt(0)) throw new Error("Invalid MP4 range");
  const start = match[1] ? BigInt(match[1]) : size > BigInt(match[2]) ? size - BigInt(match[2]) : BigInt(0);
  const requestedEnd = match[1] && match[2] ? BigInt(match[2]) : size - BigInt(1);
  const end = requestedEnd < size ? requestedEnd : size - BigInt(1);
  if (start > end) throw new Error("Invalid MP4 range");
  return { value: `bytes ${start}-${end}/${size}`, length: end - start + BigInt(1) };
}

export async function readMp4Probe(body: ReadableStream<Uint8Array> | null, expected: number): Promise<Uint8Array> {
  if (!body || expected < 24 || expected > MP4_PROBE_BYTES) throw new Error("Invalid MP4 evidence");
  const reader = body.getReader();
  const bytes = new Uint8Array(expected);
  let offset = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("MP4 probe unavailable")), 10_000); });
  try {
    while (true) {
      const { done, value } = await Promise.race([reader.read(), timeout]);
      if (done) break;
      if (offset + value.byteLength > expected) throw new Error("Invalid MP4 evidence");
      bytes.set(value, offset); offset += value.byteLength;
    }
    if (offset !== expected) throw new Error("Invalid MP4 evidence");
    return bytes;
  } finally {
    clearTimeout(timer);
    void reader.cancel().catch(() => undefined);
  }
}

// Pull-driven: no tee, whole-file buffer, or eager pump. Cancel propagates upstream.
export function boundMp4Body(body: ReadableStream<Uint8Array>, expected: bigint): ReadableStream<Uint8Array> {
  const reader = body.getReader();
  let received = BigInt(0);
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          if (received !== expected) throw new Error("Invalid MP4 length");
          controller.close(); return;
        }
        if (received + BigInt(value.byteLength) > expected) throw new Error("Invalid MP4 length");
        received += BigInt(value.byteLength);
        controller.enqueue(value);
      } catch {
        void reader.cancel().catch(() => undefined);
        controller.error(new Error("MP4 content unavailable"));
      }
    },
    cancel() { return reader.cancel().catch(() => undefined); }
  }, { highWaterMark: 0 });
}
