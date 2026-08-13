const thaiMobilePattern = /^0[689]\d{8}$/;

export class InvalidThaiMobileNumberError extends Error {
  constructor() {
    super("A valid Thai mobile number is required.");
    this.name = "InvalidThaiMobileNumberError";
  }
}

export type NormalizedThaiMobileNumber = {
  local: string;
  e164: string;
};

export function normalizeThaiMobileNumber(input: string): NormalizedThaiMobileNumber {
  const compact = input.trim().replace(/[\s()-]/g, "");
  const digits = compact.startsWith("+") ? compact.slice(1) : compact;
  const local = digits.startsWith("66") ? `0${digits.slice(2)}` : digits;

  if (!thaiMobilePattern.test(local)) {
    throw new InvalidThaiMobileNumberError();
  }

  return {
    local,
    e164: `+66${local.slice(1)}`
  };
}

export function maskThaiMobileNumber(input: string): string {
  const { local } = normalizeThaiMobileNumber(input);

  return `${local.slice(0, 3)}****${local.slice(-3)}`;
}
