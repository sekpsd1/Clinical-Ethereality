import type { Prisma } from "@prisma/client";

export type PrescriptionMedicationItem = {
  productId?: string;
  medicationName: string;
  dosage: string;
  quantity: string;
  instructions: string;
  warnings?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function parsePrescriptionItems(value: Prisma.JsonValue | null | undefined): PrescriptionMedicationItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!isRecord(item)) {
      return [];
    }

    const medicationName = typeof item.medicationName === "string" ? item.medicationName.trim() : "";
    const productId = typeof item.productId === "string" ? item.productId.trim() : "";
    const dosage = typeof item.dosage === "string" ? item.dosage.trim() : "";
    const quantity = typeof item.quantity === "string" ? item.quantity.trim() : "";
    const instructions = typeof item.instructions === "string" ? item.instructions.trim() : "";
    const warnings = typeof item.warnings === "string" ? item.warnings.trim() : "";

    if (!medicationName || !dosage || !quantity || !instructions) {
      return [];
    }

    return [
      {
        productId: productId || undefined,
        medicationName,
        dosage,
        quantity,
        instructions,
        warnings: warnings || undefined
      }
    ];
  });
}

export function formatPrescriptionItem(item: PrescriptionMedicationItem): string {
  return [
    item.medicationName,
    `ขนาด ${item.dosage}`,
    `จำนวน ${item.quantity}`,
    item.instructions,
    item.warnings ? `คำเตือน: ${item.warnings}` : null
  ]
    .filter(Boolean)
    .join(" • ");
}

export function toPrescriptionItemsJson(items: PrescriptionMedicationItem[]): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(items)) as Prisma.InputJsonValue;
}
