import { renderToStaticMarkup } from "react-dom/server";
import { chromium } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import ts from "typescript";
import * as jsxRuntime from "react/jsx-runtime";
import Link from "next/link";
import Image from "next/image";
import * as icons from "lucide-react";
import { expect, it, vi } from "vitest";
import { EmptyState } from "@/components/ui/EmptyState";
import * as categories from "@/features/products/categories";
import * as search from "@/features/products/search";
import { HealthMarketplace } from "@/features/products/HealthMarketplace";
import { AppShell } from "@/components/layout/AppShell";
import type { StoreMarketplaceData } from "@/features/products/types";

vi.mock("next/navigation", () => ({ usePathname: () => "/store" }));

const longName = "สินค้าจำลองสำหรับทดสอบชื่อสินค้ายาวที่ต้องอ่านได้ครบทุกคำและทุกบรรทัดบนหน้าจอมือถือขนาดเล็ก";
const data: StoreMarketplaceData = {
  category: "", query: "", products: [0, 1, 2].map((index) => ({
    id: `synthetic-${index}`, name: `${longName} ${index + 1}`, slug: `synthetic-${index}`,
    category: "health-equipment", categoryLabel: "อุปกรณ์สุขภาพ", price: "120 บาท",
    description: "รายละเอียดจำลองสำหรับตรวจความชัดเจนของการแสดงผล ไม่ใช่คำแนะนำทางการแพทย์",
    imageAlt: "ภาพสินค้าจำลอง", imageUrl: null, media: "kit", href: `/store/synthetic-${index}`,
    cta: "ดูสินค้า", requiresPrescription: index === 1, availableQuantity: 3,
    stockLabel: "พร้อมจัดส่ง", featured: index === 0
  }))
};

it("keeps complete names, vertically stacked media and the last card clear of the footer at mobile widths", async () => {
  execFileSync(process.execPath, ["node_modules/tailwindcss/lib/cli.js", "-i", "app/globals.css", "-o", ".next/qa/store-mobile.css", "--minify"], { stdio: "pipe" });
  const css = await readFile(".next/qa/store-mobile.css", "utf8");
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [320, 375, 390, 430]) {
      const page = await browser.newPage({ viewport: { width, height: 844 } });
      await page.setContent(`<html lang="th"><meta charset="utf-8"><style>${css}</style><body>${renderToStaticMarkup(<AppShell><HealthMarketplace data={data} /></AppShell>)}</body></html>`);
      const cards = page.getByTestId("store-product-card");
      expect(await cards.count()).toBe(3);
      const layout = await cards.evaluateAll((elements) => elements.map((element) => {
        const title = element.querySelector("h3")!;
        const image = element.querySelector("a")!;
        return { card: element.getBoundingClientRect().toJSON(), title: title.getBoundingClientRect().toJSON(), image: image.getBoundingClientRect().toJSON(), clamp: getComputedStyle(title).webkitLineClamp, clipped: title.scrollHeight > title.clientHeight + 1 };
      }));
      const list = await page.getByTestId("store-product-list").boundingBox();
      expect(layout.every((item) => Math.abs(item.card.width - list!.width) <= 1 && item.title.top >= item.image.bottom && item.clamp === "none" && !item.clipped), JSON.stringify(layout)).toBe(true);
      expect(layout[1].card.top).toBeGreaterThanOrEqual(layout[0].card.bottom);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(await page.getByRole("link", { name: "Cart", exact: true }).getAttribute("href")).toBe("/store/cart");
      expect(await page.getByRole("link", { name: "Store", exact: true }).getAttribute("aria-current")).toBe("page");
      await cards.last().scrollIntoViewIfNeeded();
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      const footer = await page.getByRole("navigation", { name: "Primary" }).boundingBox();
      const last = await cards.last().boundingBox();
      expect(last!.y + last!.height).toBeLessThanOrEqual(footer!.y);
      if (process.env.STORE_MOBILE_PROOF_DIR) {
        await cards.first().scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${process.env.STORE_MOBILE_PROOF_DIR}/store-after-${width}.png` });
        await writeFile(`${process.env.STORE_MOBILE_PROOF_DIR}/store-after-${width}.html`, await page.content());
      }
      await page.close();
    }
    if (process.env.STORE_MOBILE_PROOF_DIR) {
      const original = execFileSync("git", ["show", "e9e4177:features/products/HealthMarketplace.tsx"], { encoding: "utf8" });
      const compiled = ts.transpileModule(original, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
      const modules: Record<string, unknown> = { "react/jsx-runtime": jsxRuntime, "next/link": { default: Link }, "next/image": { default: Image }, "lucide-react": icons, "@/components/ui/EmptyState": { EmptyState }, "@/features/products/categories": categories, "@/features/products/search": search };
      const exports: { HealthMarketplace?: typeof HealthMarketplace } = {};
      new Function("require", "exports", compiled)((name: string) => modules[name], exports);
      const Before = exports.HealthMarketplace!;
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      await page.setContent(`<html lang="th"><meta charset="utf-8"><style>${css}</style><body>${renderToStaticMarkup(<AppShell><Before data={data} /></AppShell>)}</body></html>`);
      await page.locator("article").first().scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${process.env.STORE_MOBILE_PROOF_DIR}/store-before-390.png` });
    }
  } finally { await browser.close(); }
}, 30_000);
