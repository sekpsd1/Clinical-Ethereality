import { mkdir, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { Route } from "next";
import { chromium } from "@playwright/test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ConsultationChatHistory } from "@/features/consultations/chat/ConsultationChatHistory";
import type { ConsultationChatHistoryData } from "@/features/consultations/chat/history-types";

const browserUat = process.env.RUN_CHAT_HISTORY_BROWSER_UAT === "true" ? it : it.skip;

describe("consultation chat history mobile browser UAT", () => {
  browserUat("stays usable and read-only at 390x844", async () => {
    const cssDirectory = path.join(process.cwd(), ".next", "static", "css");
    const cssFiles = (await readdir(cssDirectory)).filter((file) => file.endsWith(".css"));
    const css = (await Promise.all(
      cssFiles.map((file) => readFile(path.join(cssDirectory, file), "utf8"))
    )).join("\n");
    const data: ConsultationChatHistoryData = {
      consultationId: "consultation-mobile",
      viewerRole: "customer",
      counterpartName: "พญ. แพทย์หนึ่ง",
      page: 1,
      pageSize: 50,
      totalMessages: 51,
      totalPages: 2,
      messages: [
        {
          id: "message-mobile-1",
          body: "สวัสดีค่ะ อาการวันนี้ดีขึ้นและไม่มีไข้แล้ว",
          createdAt: "2030-01-01T03:00:00.000Z",
          senderName: "ผู้รับบริการหนึ่ง",
          senderRole: "customer",
          isOwnMessage: true
        },
        {
          id: "message-mobile-2",
          body: "รับทราบค่ะ ให้ติดตามอาการตามคำแนะนำหลังการปรึกษา และติดต่อคลินิกหากอาการเปลี่ยนแปลง",
          createdAt: "2030-01-01T03:01:00.000Z",
          senderName: "พญ. แพทย์หนึ่ง",
          senderRole: "doctor",
          isOwnMessage: false
        }
      ]
    };
    const markup = renderToStaticMarkup(
      createElement(ConsultationChatHistory, {
        data,
        backHref: "/consult/appointments/consultation-mobile" as Route,
        pageHref: "/consult/appointments/consultation-mobile/chat-history"
      })
    );
    const browser = await chromium.launch({ headless: true });

    try {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      await page.setContent(
        `<!doctype html><html lang="th"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><main class="mx-auto flex min-h-dvh w-full max-w-mobile flex-col px-4">${markup}</main></body></html>`
      );

      await expect(page.getByRole("heading", { name: "ประวัติแชต" }).isVisible()).resolves.toBe(true);
      await expect(page.getByText("อ่านอย่างเดียวหลังจบการปรึกษา").isVisible()).resolves.toBe(true);
      await expect(page.getByText("ไม่รวม Zoom Chat", { exact: false }).isVisible()).resolves.toBe(true);
      const download = page.getByRole("link", { name: "ดาวน์โหลดแชต" });
      await expect(download.isVisible()).resolves.toBe(true);
      await expect(download.getAttribute("download")).resolves.toBe("clinical-lab-chat-history.txt");
      await expect(download.evaluate((element) => element.getBoundingClientRect().height)).resolves.toBeGreaterThanOrEqual(44);
      await expect(page.getByRole("link", { name: "ถัดไป" }).isVisible()).resolves.toBe(true);
      await expect(page.locator("form, textarea, input, button").count()).resolves.toBe(0);

      const viewport = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth
      }));
      expect(viewport.clientWidth).toBe(390);
      expect(viewport.scrollWidth).toBeLessThanOrEqual(390);
      await mkdir("test-results", { recursive: true });
      await page.screenshot({ path: "test-results/chat-history-download-mobile.png", fullPage: true });
    } finally {
      await browser.close();
    }
  });
});
