import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdminDashboard } from "@/features/admin/AdminDashboard";

describe("AdminDashboard", () => {
  it("links operational queues and renders real audit activity", () => {
    const html = renderToStaticMarkup(
      <AdminDashboard
        data={{
          recentActivities: [
            {
              id: "audit-1",
              title: "อัปโหลดเอกสารบุคลากร",
              detail: "file_attachment / attachment-1 · ผู้ดูแล",
              createdAt: "27 ก.ค. 2569 12:00",
              href: "/admin/users"
            }
          ],
          userApprovals: {
            pendingReview: 1,
            approvedStaff: 2,
            suspended: 0
          },
          operations: {
            pendingConsultations: 1,
            paymentsPendingReview: 1,
            prescriptionsPendingVerification: 1,
            ordersAwaitingPreparation: 1,
            lowStockProducts: 1,
            moderationQueue: 1
          }
        }}
      />
    );

    expect(html).toContain('href="/admin/users"');
    expect(html).toContain('href="/admin/payments"');
    expect(html).toContain('href="/admin/orders"');
    expect(html).toContain('href="/admin/inventory"');
    expect(html).toContain('href="/admin/moderation"');
    expect(html).toContain('href="/doctor/consultations"');
    expect(html).toContain('href="/pharmacist/prescriptions"');
    expect(html).toContain("อัปโหลดเอกสารบุคลากร");
    expect(html).not.toContain("CE-1042");
    expect(html).not.toContain("RX-209");
  });
});
