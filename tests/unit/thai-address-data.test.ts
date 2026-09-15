import { describe, expect, it } from "vitest";
import {
  getThaiAddressesByPostalCode,
  getThaiDistricts,
  getThaiPostalCodes,
  getThaiProvinces,
  getThaiSubdistricts,
  THAI_ADDRESS_DATASET,
  validateThaiAddressSelection
} from "@/lib/thai-addresses/data";

const bangkokAddress = {
  province: "กรุงเทพมหานคร",
  district: "คลองเตย",
  subdistrict: "คลองเตย",
  postalCode: "10110"
};

describe("Thai address dataset", () => {
  it("pins a complete attributed hierarchy and provides dependent options", () => {
    expect(THAI_ADDRESS_DATASET).toMatchObject({
      packageVersion: "0.1.4",
      license: "MIT",
      rowCount: 7436,
      upstreamCommit: "c76e019fe7a2d51cafd40be8261f59b10310f9d1"
    });
    expect(getThaiProvinces()).toContain("กรุงเทพมหานคร");
    expect(getThaiProvinces()).toHaveLength(77);
    expect(getThaiDistricts("กรุงเทพมหานคร")).toContain("คลองเตย");
    expect(getThaiSubdistricts("กรุงเทพมหานคร", "คลองเตย")).toContain("คลองเตย");
    expect(getThaiPostalCodes("กรุงเทพมหานคร", "คลองเตย", "คลองเตย")).toEqual(["10110"]);
  });

  it("accepts only an exact server-known province hierarchy and postal code", () => {
    expect(validateThaiAddressSelection(bangkokAddress)).toEqual({ status: "canonical" });
    expect(validateThaiAddressSelection({ ...bangkokAddress, district: "พระนคร" })).toEqual({ status: "invalid" });
    expect(validateThaiAddressSelection({ ...bangkokAddress, postalCode: "10200" })).toEqual({ status: "invalid" });
  });

  it("does not infer a full address from an ambiguous postal code", () => {
    const matches = getThaiAddressesByPostalCode("10110");
    expect(matches.length).toBeGreaterThan(1);
    expect(new Set(matches.map((row) => `${row.district}/${row.subdistrict}`)).size).toBeGreaterThan(1);
  });

  it("preserves an unchanged legacy hierarchy but rejects partial legacy tampering", () => {
    const legacy = {
      province: "จังหวัดเดิม",
      district: "อำเภอเดิม",
      subdistrict: "ตำบลเดิม",
      postalCode: "99999"
    };

    expect(validateThaiAddressSelection(legacy, legacy)).toEqual({ status: "legacy_unchanged" });
    expect(validateThaiAddressSelection({ ...legacy, district: "อำเภออื่น" }, legacy)).toEqual({ status: "invalid" });
  });
});
