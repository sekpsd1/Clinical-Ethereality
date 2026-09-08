const LIFF_ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;

export function buildLineProfileReturnUrl(liffId: string | undefined): string | null {
  const normalizedLiffId = liffId?.trim();

  if (!normalizedLiffId || !LIFF_ID_PATTERN.test(normalizedLiffId)) {
    return null;
  }

  return `https://liff.line.me/${normalizedLiffId}/profile`;
}
