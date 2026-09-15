import rows, { buildMeta, type ThaiAddressRow } from "@riz007/thai-address-data";

export type ThaiAddressSelection = {
  province: string;
  district: string;
  subdistrict: string;
  postalCode: string;
};

export type ThaiAddressValidationResult =
  | { status: "canonical" }
  | { status: "legacy_unchanged" }
  | { status: "invalid" };

export const THAI_ADDRESS_DATASET = {
  packageName: "@riz007/thai-address-data",
  packageVersion: "0.1.4",
  upstreamRepository: "https://github.com/thailand-geography-data/thailand-geography-json",
  upstreamCommit: buildMeta.sourceCommit,
  license: "MIT",
  rowCount: rows.length
} as const;

function compareThai(left: string, right: string): number {
  return left.localeCompare(right, "th");
}

function uniqueSorted(values: Iterable<string>): string[] {
  return Array.from(new Set(values)).sort(compareThai);
}

export function getThaiAddressRows(): readonly ThaiAddressRow[] {
  return rows;
}

export function getThaiProvinces(data: readonly ThaiAddressRow[] = rows): string[] {
  return uniqueSorted(data.map((row) => row.province));
}

export function getThaiDistricts(
  province: string,
  data: readonly ThaiAddressRow[] = rows
): string[] {
  return uniqueSorted(
    data.filter((row) => row.province === province).map((row) => row.district)
  );
}

export function getThaiSubdistricts(
  province: string,
  district: string,
  data: readonly ThaiAddressRow[] = rows
): string[] {
  return uniqueSorted(
    data
      .filter((row) => row.province === province && row.district === district)
      .map((row) => row.subdistrict)
  );
}

export function getThaiPostalCodes(
  province: string,
  district: string,
  subdistrict: string,
  data: readonly ThaiAddressRow[] = rows
): string[] {
  return uniqueSorted(
    data
      .filter(
        (row) =>
          row.province === province &&
          row.district === district &&
          row.subdistrict === subdistrict
      )
      .map((row) => row.zipcode)
  );
}

export function getThaiAddressesByPostalCode(
  postalCode: string,
  data: readonly ThaiAddressRow[] = rows
): readonly ThaiAddressRow[] {
  return data.filter((row) => row.zipcode === postalCode);
}

function normalizeSelection(selection: ThaiAddressSelection): ThaiAddressSelection {
  return {
    province: selection.province.trim(),
    district: selection.district.trim(),
    subdistrict: selection.subdistrict.trim(),
    postalCode: selection.postalCode.trim()
  };
}

function selectionsEqual(
  left: ThaiAddressSelection,
  right: ThaiAddressSelection
): boolean {
  const normalizedLeft = normalizeSelection(left);
  const normalizedRight = normalizeSelection(right);

  return (
    normalizedLeft.province === normalizedRight.province &&
    normalizedLeft.district === normalizedRight.district &&
    normalizedLeft.subdistrict === normalizedRight.subdistrict &&
    normalizedLeft.postalCode === normalizedRight.postalCode
  );
}

export function validateThaiAddressSelection(
  selection: ThaiAddressSelection,
  existingSelection?: ThaiAddressSelection | null,
  data: readonly ThaiAddressRow[] = rows
): ThaiAddressValidationResult {
  if (existingSelection && selectionsEqual(selection, existingSelection)) {
    const canonical = validateThaiAddressSelection(selection, null, data);
    return canonical.status === "canonical"
      ? canonical
      : { status: "legacy_unchanged" };
  }

  const normalized = normalizeSelection(selection);
  const canonical = data.some(
    (row) =>
      row.province === normalized.province &&
      row.district === normalized.district &&
      row.subdistrict === normalized.subdistrict &&
      row.zipcode === normalized.postalCode
  );

  return canonical ? { status: "canonical" } : { status: "invalid" };
}

export function isBangkokProvince(province: string): boolean {
  return province.trim() === "กรุงเทพมหานคร";
}
