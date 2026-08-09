import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { access, rm } from "node:fs/promises";
import { issueSessionToken } from "@/lib/auth/jwt";
import { authCookieNames } from "@/lib/auth/cookies";
import { resolvePaymentSlipPath } from "@/features/payments/private-slips";

const prisma = new PrismaClient();
const tag = `private-slip-uat-${Date.now()}`;
const png = Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360f8cfc0000004010100f85f6d7d0000000049454e44ae426082", "hex");

type Fixtures = {
  adminId: string;
  consultationId: string;
  customerOneId: string;
  customerOneLineId: string;
  customerTwoId: string;
  customerTwoLineId: string;
  doctorId: string;
  doctorUserId: string;
  orderId: string;
  productId: string;
  storePaymentId: string;
};

let fixtures: Fixtures;
let attachmentPaths: string[] = [];

function assertUatTarget() {
  const url = new URL(process.env.DATABASE_URL ?? "");
  const database = decodeURIComponent(url.pathname).replace(/^\/+/, "");

  if (!(["127.0.0.1", "localhost"].includes(url.hostname) && url.port === "3307" && database === "clinical_ethereality_private_slip_uat")) {
    throw new Error("Private slip E2E must only run against the isolated local UAT database.");
  }
}

async function setCustomerTwoSession(context: BrowserContext) {
  const token = await issueSessionToken(
    {
      userId: fixtures.customerTwoId,
      lineUserId: fixtures.customerTwoLineId,
      role: "customer",
      displayName: "Private Slip UAT Customer 2"
    },
    "access"
  );

  await context.addCookies([
    {
      name: authCookieNames.access,
      value: token,
      url: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3001",
      httpOnly: true,
      sameSite: "Lax"
    }
  ]);
}

async function signInWithDevSession(page: Page, role: "customer" | "admin") {
  const response = await page.request.post("/api/auth/dev-session", { data: { role } });
  expect(response.status()).toBe(200);
}

async function uploadThroughUi(page: Page) {
  const form = page.locator("form").filter({ has: page.locator('input[type="file"]') });
  await expect(form).toHaveCount(1);
  await form.locator('input[type="file"]').setInputFiles({
    name: "private-slip-fixture.png",
    mimeType: "image/png",
    buffer: png
  });
  const responsePromise = page.waitForResponse(
    (response) => response.url().includes("/api/payments/private-slip") && response.request().method() === "POST"
  );
  await form.locator('button[type="submit"]').click();
  const response = await responsePromise;
  expect(response.status()).toBe(200);
}

async function expectMobileHealthy(page: Page, responses: number[], pageErrors: string[]) {
  await expect(page.locator("body")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(pageErrors).toEqual([]);
  expect(responses).toEqual([]);
}

async function deleteFixtures() {
  if (!fixtures) return;

  const paymentIds = [fixtures.storePaymentId];
  const consultationPayment = await prisma.payment.findUnique({
    where: { consultationId: fixtures.consultationId },
    select: { id: true }
  });
  if (consultationPayment) paymentIds.push(consultationPayment.id);

  const attachments = await prisma.fileAttachment.findMany({
    where: { entityId: { in: paymentIds }, entityType: "payment_slip" },
    select: { storageKey: true }
  });
  attachmentPaths = [...attachmentPaths, ...attachments.flatMap((attachment) => (attachment.storageKey ? [resolvePaymentSlipPath(attachment.storageKey)] : []))];

  await prisma.fileAttachment.deleteMany({ where: { ownerId: { in: [fixtures.customerOneId, fixtures.customerTwoId] } } });
  await prisma.auditLog.deleteMany({ where: { actorId: { in: [fixtures.customerOneId, fixtures.customerTwoId, fixtures.adminId] } } });
  await prisma.payment.deleteMany({ where: { id: { in: paymentIds } } });
  await prisma.consultation.deleteMany({ where: { id: fixtures.consultationId } });
  await prisma.order.deleteMany({ where: { id: fixtures.orderId } });
  await prisma.inventory.deleteMany({ where: { productId: fixtures.productId } });
  await prisma.product.deleteMany({ where: { id: fixtures.productId } });
  await prisma.doctor.deleteMany({ where: { id: fixtures.doctorId } });
  await prisma.user.deleteMany({ where: { id: { in: [fixtures.customerOneId, fixtures.customerTwoId, fixtures.adminId, fixtures.doctorUserId] } } });

  await Promise.all(attachmentPaths.map((filePath) => rm(filePath, { force: true })));
}

test.describe.configure({ mode: "serial" });

test.describe("private payment slip browser UAT", () => {
  test.beforeAll(async () => {
    assertUatTarget();

    const customerOne = await prisma.user.create({
      data: { lineUserId: "seed-line-customer", displayName: "Private Slip UAT Customer 1", role: "customer", status: "active" }
    });
    const customerTwo = await prisma.user.create({
      data: { lineUserId: `${tag}-customer-2`, displayName: "Private Slip UAT Customer 2", role: "customer", status: "active" }
    });
    const admin = await prisma.user.create({
      data: { lineUserId: "seed-line-admin", displayName: "Private Slip UAT Admin", role: "admin", status: "active" }
    });
    const doctorUser = await prisma.user.create({
      data: { lineUserId: `${tag}-doctor`, displayName: "Private Slip UAT Doctor", role: "doctor", status: "active" }
    });
    const doctor = await prisma.doctor.create({
      data: { userId: doctorUser.id, status: "approved", consultationFee: 750, approvedAt: new Date() }
    });
    const product = await prisma.product.create({
      data: { name: "Private Slip UAT Product", slug: tag, category: "uat", price: 120, status: "active" }
    });
    await prisma.inventory.create({ data: { productId: product.id, quantity: 10, reservedQuantity: 1 } });
    const order = await prisma.order.create({
      data: {
        userId: customerOne.id,
        status: "pending_payment",
        subtotal: 120,
        grandTotal: 120,
        items: { create: { productId: product.id, quantity: 1, unitPrice: 120, lineTotal: 120 } },
        payments: { create: { amount: 120, status: "pending_slip" } }
      },
      include: { payments: true }
    });
    const consultation = await prisma.consultation.create({
      data: { patientId: customerOne.id, doctorId: doctor.id, status: "pending_payment", scheduledAt: new Date(Date.now() + 86_400_000) }
    });

    fixtures = {
      adminId: admin.id,
      consultationId: consultation.id,
      customerOneId: customerOne.id,
      customerOneLineId: customerOne.lineUserId,
      customerTwoId: customerTwo.id,
      customerTwoLineId: customerTwo.lineUserId,
      doctorId: doctor.id,
      doctorUserId: doctorUser.id,
      orderId: order.id,
      productId: product.id,
      storePaymentId: order.payments[0].id
    };
  });

  test.afterAll(async () => {
    await deleteFixtures();
    await prisma.$disconnect();
  });

  test("uploads Store and Consultation slips through the mobile UI with owner-only private reads", async ({ browser }) => {
    const owner = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const other = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const admin = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const anonymous = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const ownerPage = await owner.newPage();
    const otherPage = await other.newPage();
    const adminPage = await admin.newPage();
    const anonymousPage = await anonymous.newPage();
    const responses: number[] = [];
    const pageErrors: string[] = [];

    ownerPage.on("response", (response) => {
      if (response.status() >= 500) responses.push(response.status());
    });
    ownerPage.on("pageerror", (error) => pageErrors.push(error.message));

    await signInWithDevSession(ownerPage, "customer");
    const session = await ownerPage.request.get("/api/auth/session");
    const sessionPayload = (await session.json()) as { session: { userId: string } };
    expect(sessionPayload.session.userId).toBe(fixtures.customerOneId);
    await setCustomerTwoSession(other);
    await signInWithDevSession(adminPage, "admin");

    expect((await ownerPage.goto("/store/orders"))?.status()).toBe(200);
    await uploadThroughUi(ownerPage);
    await expectMobileHealthy(ownerPage, responses, pageErrors);

    const afterStore = await prisma.payment.findUniqueOrThrow({
      where: { id: fixtures.storePaymentId },
      include: { order: { include: { items: true } } }
    });
    expect(afterStore.status).toBe("pending_review");
    expect(afterStore.order?.status).toBe("payment_review");
    expect(afterStore.order?.items).toHaveLength(1);
    const inventoryAfterStore = await prisma.inventory.findUniqueOrThrow({ where: { productId: fixtures.productId } });
    expect(inventoryAfterStore.reservedQuantity).toBe(1);

    const storeAttachments = await prisma.fileAttachment.findMany({ where: { entityId: fixtures.storePaymentId, entityType: "payment_slip", status: "attached" } });
    expect(storeAttachments).toHaveLength(1);
    expect(storeAttachments[0].storageUrl).toMatch(/^\/api\/payments\/slips\//);
    expect(storeAttachments[0].storageKey).toBeTruthy();
    const storePath = resolvePaymentSlipPath(storeAttachments[0].storageKey!);
    await expect(access(storePath)).resolves.toBeUndefined();
    attachmentPaths.push(storePath);
    expect(await prisma.auditLog.count({ where: { action: "payment.private_slip_uploaded", entityId: fixtures.storePaymentId } })).toBe(1);
    expect(await prisma.notification.count({ where: { userId: fixtures.customerOneId, type: "payment" } })).toBe(1);

    const ownerFile = await ownerPage.request.get(`/api/payments/slips/${storeAttachments[0].id}`);
    expect(ownerFile.status()).toBe(200);
    expect(ownerFile.headers()["cache-control"]).toBe("private, no-store");
    expect((await otherPage.request.get(`/api/payments/slips/${storeAttachments[0].id}`)).status()).toBe(404);
    expect((await anonymousPage.request.get(`/api/payments/slips/${storeAttachments[0].id}`)).status()).toBe(401);
    expect((await adminPage.request.get(`/api/payments/slips/${storeAttachments[0].id}`)).status()).toBe(200);
    expect((await anonymousPage.request.get(storeAttachments[0].storageUrl)).status()).toBe(401);
    expect((await anonymousPage.request.get(`/${storeAttachments[0].storageKey}`)).status()).toBe(404);

    const storeRetry = await ownerPage.request.post("/api/payments/private-slip", {
      multipart: { paymentId: fixtures.storePaymentId, file: { name: "retry.png", mimeType: "image/png", buffer: png } }
    });
    expect(storeRetry.status()).toBe(409);
    expect(await prisma.fileAttachment.count({ where: { entityId: fixtures.storePaymentId, entityType: "payment_slip" } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { action: "payment.private_slip_uploaded", entityId: fixtures.storePaymentId } })).toBe(1);
    expect(await prisma.notification.count({ where: { userId: fixtures.customerOneId, type: "payment" } })).toBe(1);

    expect((await ownerPage.goto(`/consult/payment?consultation=${fixtures.consultationId}`))?.status()).toBe(200);
    await uploadThroughUi(ownerPage);
    await expectMobileHealthy(ownerPage, responses, pageErrors);

    const consultationPayment = await prisma.payment.findUniqueOrThrow({ where: { consultationId: fixtures.consultationId } });
    expect(consultationPayment.status).toBe("pending_review");
    expect(consultationPayment.reviewedById).toBeNull();
    expect(consultationPayment.reviewedAt).toBeNull();
    const consultationAttachments = await prisma.fileAttachment.findMany({ where: { entityId: consultationPayment.id, entityType: "payment_slip", status: "attached" } });
    expect(consultationAttachments).toHaveLength(1);
    const consultationPath = resolvePaymentSlipPath(consultationAttachments[0].storageKey!);
    await expect(access(consultationPath)).resolves.toBeUndefined();
    attachmentPaths.push(consultationPath);
    expect(await prisma.auditLog.count({ where: { action: "consultation.private_slip_uploaded", entityId: fixtures.consultationId } })).toBe(1);
    expect(await prisma.notification.count({ where: { userId: fixtures.customerOneId, type: "consultation" } })).toBe(1);
    expect((await otherPage.request.get(`/api/payments/slips/${consultationAttachments[0].id}`)).status()).toBe(404);
    expect((await adminPage.request.get(`/api/payments/slips/${consultationAttachments[0].id}`)).status()).toBe(200);

    const consultationRetry = await ownerPage.request.post("/api/payments/private-slip", {
      multipart: { consultationId: fixtures.consultationId, file: { name: "retry.png", mimeType: "image/png", buffer: png } }
    });
    expect(consultationRetry.status()).toBe(409);
    expect(await prisma.fileAttachment.count({ where: { entityId: consultationPayment.id, entityType: "payment_slip" } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { action: "consultation.private_slip_uploaded", entityId: fixtures.consultationId } })).toBe(1);
    expect(await prisma.notification.count({ where: { userId: fixtures.customerOneId, type: "consultation" } })).toBe(1);
    expect((await prisma.inventory.findUniqueOrThrow({ where: { productId: fixtures.productId } })).reservedQuantity).toBe(1);

    await Promise.all([owner.close(), other.close(), admin.close(), anonymous.close()]);
  });
});
