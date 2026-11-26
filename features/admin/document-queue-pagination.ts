export const documentQueuePageSize = 50;

export function parseDocumentQueuePage(value: string | string[] | undefined): number {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return 1;
  const page = Number(value);
  return Number.isSafeInteger(page) && page >= 1 ? page : 1;
}

export function getDocumentQueuePagination(total: number, requestedPage: number) {
  const totalPages = Math.max(1, Math.ceil(total / documentQueuePageSize));
  return { page: Math.min(requestedPage, totalPages), totalPages };
}

export type DocumentQueuePagination = ReturnType<typeof getDocumentQueuePagination>;
