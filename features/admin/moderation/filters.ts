import type { AdminModerationQueueItem } from "@/features/admin/moderation/types";

export type ModerationTypeFilter = AdminModerationQueueItem["type"] | "all";
export type ModerationStatusFilter = AdminModerationQueueItem["status"] | "all" | "pending";

export type AdminModerationFilters = {
  query: string;
  type: ModerationTypeFilter;
  reason: string;
  status: ModerationStatusFilter;
  includeArchived: boolean;
  includeTestItems: boolean;
};

export const defaultAdminModerationFilters: AdminModerationFilters = {
  query: "",
  type: "all",
  reason: "all",
  status: "all",
  includeArchived: false,
  includeTestItems: false
};

export function isTestModerationItem(
  item: Pick<AdminModerationQueueItem, "body" | "reportDetails" | "title">
): boolean {
  const text = `${item.title} ${item.body} ${item.reportDetails ?? ""}`.trim().toLocaleLowerCase("th-TH");

  return (
    text.includes("[uat]") ||
    text.includes("[test]") ||
    text.startsWith("uat-") ||
    text.startsWith("test-") ||
    text.includes(" uat ") ||
    text.includes(" test fixture") ||
    text.includes("browser-")
  );
}

export function filterAdminModerationItems(
  items: AdminModerationQueueItem[],
  filters: AdminModerationFilters
): AdminModerationQueueItem[] {
  const normalizedQuery = filters.query.trim().replace(/\s+/g, " ").toLocaleLowerCase("th-TH");

  return items.filter((item) => {
    if (!filters.includeTestItems && isTestModerationItem(item)) {
      return false;
    }

    if (!filters.includeArchived && item.status === "archived") {
      return false;
    }

    if (filters.type !== "all" && item.type !== filters.type) {
      return false;
    }

    if (filters.reason !== "all" && item.reportReasonCode !== filters.reason) {
      return false;
    }

    if (filters.status === "pending" && !item.reportId) {
      return false;
    }

    if (filters.status !== "all" && filters.status !== "pending" && item.status !== filters.status) {
      return false;
    }

    if (normalizedQuery) {
      const searchableText = [
        item.title,
        item.body,
        item.authorName,
        item.reporterName,
        item.reportReason,
        item.reportDetails
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("th-TH");

      if (!searchableText.includes(normalizedQuery)) {
        return false;
      }
    }

    return true;
  });
}

export function sortAdminModerationItems(items: AdminModerationQueueItem[]): AdminModerationQueueItem[] {
  return [...items].sort((left, right) => Number(Boolean(right.reportId)) - Number(Boolean(left.reportId)));
}
