import type { Prisma } from "@prisma/client";
import { formatShippingAddress } from "@/features/profile/shipping-addresses/types";

export const shippingDocumentSelect = {
  recipientName: true,
  phone: true,
  addressLine1: true,
  addressLine2: true,
  subdistrict: true,
  district: true,
  province: true,
  postalCode: true
} as const;

type ShippingDocumentAddress = Prisma.OrderShippingAddressGetPayload<{ select: typeof shippingDocumentSelect }>;

export function hasPrintableShippingAddress(address: ShippingDocumentAddress | null): address is ShippingDocumentAddress {
  return !!address && [
    address.recipientName, address.phone, address.addressLine1,
    address.subdistrict, address.district, address.province, address.postalCode
  ].every(value => value.trim().length > 0);
}

function escapeText(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export function renderShippingAddress(address: ShippingDocumentAddress, printNonce?: string) {
  return `<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ที่อยู่จัดส่ง</title>
  <style>
    body { margin: 0; padding: 24px; color: #191c1e; background: #fff; font: 16px/1.6 system-ui, "Leelawadee UI", Tahoma, sans-serif; }
    main { max-width: 28rem; margin: 0 auto; }
    h1 { font-size: 1.25em; margin: 0 0 8px; }
    address { border: 1px solid #647471; padding: 16px; font-style: normal; overflow-wrap: anywhere; break-inside: avoid; }
    p { margin: 0; }
    button { margin-top: 16px; padding: 8px 16px; font: inherit; cursor: pointer; }
    @media print { body { padding: 12mm; } main { margin: 0; } button { display: none; } }
    @page { margin: 0; }
  </style>
</head>
<body>
  <main>
    <h1>ที่อยู่จัดส่ง</h1>
    <address>
      <p><strong>${escapeText(address.recipientName)}</strong></p>
      <p>${escapeText(formatShippingAddress(address))}</p>
      <p>โทร. ${escapeText(address.phone)}</p>
    </address>
    ${printNonce ? `<button id="print" type="button">พิมพ์ที่อยู่</button>
    <script nonce="${printNonce}">document.getElementById("print").addEventListener("click", () => window.print());</script>` : ""}
  </main>
</body>
</html>`;
}
