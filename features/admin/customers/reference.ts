export function formatCustomerReference(lineUserId: string): string {
  const suffix = lineUserId.slice(-6);

  return `LINE •••${suffix}`;
}
