import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { PublicSession } from "@/lib/auth/types";

const mocks = vi.hoisted(() => ({
  requireRoleSession: vi.fn(),
  getCustomerProfileData: vi.fn(),
  getCustomerNotifications: vi.fn(),
  getCustomerUpcomingAppointment: vi.fn(),
  userProfile: vi.fn()
}));

vi.mock("@/lib/auth/guards", () => ({ requireRoleSession: mocks.requireRoleSession }));
vi.mock("@/features/profile/queries", () => ({ getCustomerProfileData: mocks.getCustomerProfileData }));
vi.mock("@/features/notifications/queries", () => ({ getCustomerNotifications: mocks.getCustomerNotifications }));
vi.mock("@/features/profile/upcoming-appointment", () => ({ getCustomerUpcomingAppointment: mocks.getCustomerUpcomingAppointment }));
vi.mock("@/features/profile/UserProfile", () => ({ UserProfile: mocks.userProfile }));

import ProfilePage from "@/app/(app)/profile/page";

const customerSession: PublicSession = {
  userId: "customer-1",
  lineUserId: "line-customer-1",
  role: "customer",
  expiresAt: "2030-01-01T00:00:00.000Z"
};

describe("profile notification data", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireRoleSession.mockResolvedValue(customerSession);
    mocks.getCustomerProfileData.mockResolvedValue({ displayName: "Customer", fullName: null, dateOfBirth: null, avatarUrl: null, email: null, phone: null, phoneVerifiedAt: null, memberStatus: "สมาชิก LINE", adviceCount: 0, postCount: 0 });
    mocks.getCustomerNotifications.mockResolvedValue({ notifications: [], unreadCount: 0 });
    mocks.getCustomerUpcomingAppointment.mockResolvedValue({ appointment: null });
    mocks.userProfile.mockReturnValue(null);
  });

  it("uses the customer role guard and reads profile notifications without a mutation action", async () => {
    renderToStaticMarkup(await ProfilePage());

    expect(mocks.requireRoleSession).toHaveBeenCalledWith(["customer"], "/profile");
    expect(mocks.getCustomerProfileData).toHaveBeenCalledWith(customerSession);
    expect(mocks.getCustomerNotifications).toHaveBeenCalledWith(customerSession);
    expect(mocks.getCustomerUpcomingAppointment).toHaveBeenCalledWith(customerSession);
    expect(mocks.userProfile).toHaveBeenCalledWith(expect.objectContaining({ notificationData: { notifications: [], unreadCount: 0 }, upcomingAppointmentData: { appointment: null } }), undefined);
  });
});
