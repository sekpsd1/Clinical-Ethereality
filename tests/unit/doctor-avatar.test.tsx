import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DoctorAvatar } from "@/features/consultations/DoctorAvatar";

describe("DoctorAvatar", () => {
  it("renders the selected staff avatar immediately instead of the fallback", () => {
    const avatarUrl = "/api/staff-files/websthai-profile";
    const html = renderToStaticMarkup(<DoctorAvatar src={avatarUrl} alt="Websthai" fallbackSrc="/images/doctors/waiting-avatar.png" />);

    expect(html).toContain(`src="${avatarUrl}"`);
    expect(html).not.toContain("waiting-avatar.png");
  });
});
