export function formatCustomerReference(lineUserId: string): string {
  const suffix = lineUserId.slice(-6);

  return `LINE •••${suffix}`;
}

export function getCustomerTestResetConfirmation(reference: string): string {
  return `RESET ${reference}`;
}

export function isAllowlistedCustomerTestAccount(
  lineUserId: string,
  rawAllowlist = process.env.CUSTOMER_TEST_RESET_LINE_USER_IDS
): boolean {
  if (!rawAllowlist) {
    return false;
  }

  return rawAllowlist
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .includes(lineUserId);
}
