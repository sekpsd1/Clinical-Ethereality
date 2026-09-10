const thaiNationalIdPattern = /^\d{13}$/;

export class InvalidThaiNationalIdError extends Error {
  constructor() {
    super("A valid Thai national ID is required.");
    this.name = "InvalidThaiNationalIdError";
  }
}

export function normalizeThaiNationalId(input: string): string {
  const value = input.trim().replace(/\D/g, "");

  if (!thaiNationalIdPattern.test(value)) {
    throw new InvalidThaiNationalIdError();
  }

  const weightedSum = value
    .slice(0, 12)
    .split("")
    .reduce((sum, digit, index) => sum + Number(digit) * (13 - index), 0);
  const checkDigit = (11 - (weightedSum % 11)) % 10;

  if (Number(value[12]) !== checkDigit) {
    throw new InvalidThaiNationalIdError();
  }

  return value;
}
