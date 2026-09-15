"use client";

import { useEffect, useMemo, useState } from "react";
import type { ThaiAddressRow } from "@riz007/thai-address-data";
import type { ThaiAddressSelection } from "@/lib/thai-addresses/data";

type LoadStatus = "loading" | "ready" | "error";

const BANGKOK = "กรุงเทพมหานคร";

function uniqueSorted(values: Iterable<string>): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right, "th"));
}

function withLegacyOption(options: string[], value: string): string[] {
  return value && !options.includes(value) ? [value, ...options] : options;
}

export function ThaiAddressFields({ value }: { value?: ThaiAddressSelection }) {
  const [rows, setRows] = useState<readonly ThaiAddressRow[]>([]);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const [province, setProvince] = useState(value?.province ?? "");
  const [district, setDistrict] = useState(value?.district ?? "");
  const [subdistrict, setSubdistrict] = useState(value?.subdistrict ?? "");
  const [postalCode, setPostalCode] = useState(value?.postalCode ?? "");

  useEffect(() => {
    let active = true;
    setLoadStatus("loading");

    import("@riz007/thai-address-data")
      .then((module) => {
        if (!active) return;
        setRows(module.data);
        setLoadStatus("ready");
      })
      .catch(() => {
        if (!active) return;
        setLoadStatus("error");
      });

    return () => {
      active = false;
    };
  }, [reloadKey]);

  const provinces = useMemo(
    () => withLegacyOption(uniqueSorted(rows.map((row) => row.province)), province),
    [province, rows]
  );
  const districts = useMemo(
    () =>
      withLegacyOption(
        uniqueSorted(rows.filter((row) => row.province === province).map((row) => row.district)),
        district
      ),
    [district, province, rows]
  );
  const subdistricts = useMemo(
    () =>
      withLegacyOption(
        uniqueSorted(
          rows
            .filter((row) => row.province === province && row.district === district)
            .map((row) => row.subdistrict)
        ),
        subdistrict
      ),
    [district, province, rows, subdistrict]
  );
  const postalCodes = useMemo(
    () =>
      uniqueSorted(
        rows
          .filter(
            (row) =>
              row.province === province &&
              row.district === district &&
              row.subdistrict === subdistrict
          )
          .map((row) => row.zipcode)
      ),
    [district, province, rows, subdistrict]
  );
  const postalMatches = useMemo(
    () => (postalCode.length === 5 ? rows.filter((row) => row.zipcode === postalCode) : []),
    [postalCode, rows]
  );
  const isLegacyHierarchy =
    loadStatus === "ready" &&
    Boolean(province && district && subdistrict && postalCode) &&
    !rows.some(
      (row) =>
        row.province === province &&
        row.district === district &&
        row.subdistrict === subdistrict &&
        row.zipcode === postalCode
    );
  const districtLabel = province === BANGKOK ? "เขต" : "อำเภอ";
  const subdistrictLabel = province === BANGKOK ? "แขวง" : "ตำบล";

  function handleProvinceChange(nextProvince: string) {
    setProvince(nextProvince);
    setDistrict("");
    setSubdistrict("");
    setPostalCode("");
  }

  function handleDistrictChange(nextDistrict: string) {
    setDistrict(nextDistrict);
    setSubdistrict("");
    setPostalCode("");
  }

  function handleSubdistrictChange(nextSubdistrict: string) {
    setSubdistrict(nextSubdistrict);
    const matches = rows.filter(
      (row) =>
        row.province === province &&
        row.district === district &&
        row.subdistrict === nextSubdistrict
    );
    const options = uniqueSorted(matches.map((row) => row.zipcode));
    setPostalCode(options.length === 1 ? options[0] : "");
  }

  function handlePostalCodeChange(nextPostalCode: string) {
    const normalized = nextPostalCode.replace(/\D/g, "").slice(0, 5);
    setPostalCode(normalized);

    if (normalized.length !== 5) return;
    const matches = rows.filter((row) => row.zipcode === normalized);
    if (matches.length === 1) {
      const [match] = matches;
      setProvince(match.province);
      setDistrict(match.district);
      setSubdistrict(match.subdistrict);
    }
  }

  return (
    <fieldset className="space-y-3" aria-describedby="thai-address-status">
      <legend className="sr-only">จังหวัด เขตหรืออำเภอ แขวงหรือตำบล และรหัสไปรษณีย์</legend>

      <AddressSelect
        label="จังหวัด"
        name="province"
        value={province}
        options={provinces}
        disabled={loadStatus !== "ready"}
        onChange={handleProvinceChange}
      />
      <AddressSelect
        label={districtLabel}
        name="district"
        value={district}
        options={districts}
        disabled={loadStatus !== "ready" || !province}
        onChange={handleDistrictChange}
      />
      <AddressSelect
        label={subdistrictLabel}
        name="subdistrict"
        value={subdistrict}
        options={subdistricts}
        disabled={loadStatus !== "ready" || !province || !district}
        onChange={handleSubdistrictChange}
      />

      <label className="block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6e797a]">
        รหัสไปรษณีย์
        <input
          required
          name="postalCode"
          value={postalCode}
          onChange={(event) => handlePostalCodeChange(event.target.value)}
          inputMode="numeric"
          autoComplete="postal-code"
          pattern="[0-9]{5}"
          placeholder="10110"
          className="mt-2 h-11 w-full rounded-[12px] border border-[#bdc9ca]/60 bg-white px-3 text-sm font-medium normal-case tracking-normal text-[#191c1e] outline-none focus:border-primary"
        />
      </label>

      <div id="thai-address-status" aria-live="polite" className="text-xs leading-5 text-[#6e797a]">
        <ThaiAddressLoadMessage
          status={loadStatus}
          onRetry={() => setReloadKey((key) => key + 1)}
        />
        {isLegacyHierarchy ? (
          <p className="rounded-[12px] bg-warning/10 px-3 py-2 font-semibold text-warning">
            ที่อยู่นี้เป็นข้อมูลเดิมและยังบันทึกต่อได้หากไม่เปลี่ยนจังหวัด เขต/อำเภอ แขวง/ตำบล หรือรหัสไปรษณีย์
          </p>
        ) : null}
        {loadStatus === "ready" && postalCode.length === 5 && postalMatches.length > 1 && !subdistrict ? (
          <p>รหัสไปรษณีย์นี้ใช้กับหลายพื้นที่ กรุณาเลือกจังหวัด {districtLabel} และ{subdistrictLabel}ให้ครบ</p>
        ) : null}
        {loadStatus === "ready" && subdistrict && postalCodes.length > 1 ? (
          <p>พื้นที่นี้มีหลายรหัสไปรษณีย์ กรุณาตรวจสอบรหัสให้ตรงกับจุดจัดส่ง</p>
        ) : null}
      </div>
    </fieldset>
  );
}

export function ThaiAddressLoadMessage({
  status,
  onRetry
}: {
  status: LoadStatus;
  onRetry: () => void;
}) {
  if (status === "loading") {
    return <p>กำลังโหลดข้อมูลที่อยู่ประเทศไทย...</p>;
  }

  if (status === "error") {
    return (
      <p className="rounded-[12px] bg-danger/10 px-3 py-2 font-semibold text-danger">
        โหลดข้อมูลที่อยู่ไม่สำเร็จ{" "}
        <button type="button" className="underline" onClick={onRetry}>
          ลองใหม่
        </button>
      </p>
    );
  }

  return null;
}

function AddressSelect({
  label,
  name,
  value,
  options,
  disabled,
  onChange
}: {
  label: string;
  name: "province" | "district" | "subdistrict";
  value: string;
  options: string[];
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6e797a]">
      {label}
      <select
        required
        name={name}
        autoComplete={
          name === "province" ? "address-level1" : name === "district" ? "address-level2" : "address-level3"
        }
        value={value}
        aria-disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-11 w-full rounded-[12px] border border-[#bdc9ca]/60 bg-white px-3 text-sm font-medium normal-case tracking-normal text-[#191c1e] outline-none focus:border-primary aria-disabled:bg-[#eef2f2] aria-disabled:text-[#6e797a]"
      >
        <option value="">เลือก{label}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
