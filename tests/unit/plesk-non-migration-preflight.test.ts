/* eslint-disable @typescript-eslint/no-require-imports */
import { describe, expect, it, vi } from "vitest";
const {
  MIGRATION_APPROVAL_ENV,
  RECONCILIATION_APPROVAL_ENV,
  assertNoPleskMigrationTarget,
  hasPleskMigrationTarget,
  hasPleskRuntimeMutationTarget,
} = require("../../scripts/plesk-non-migration-preflight.cjs");

describe("Plesk non-migration preflight", () => {
  it("allows startup when the migration approval key is absent", () => {
    const error = vi.fn();

    expect(hasPleskMigrationTarget({})).toBe(false);
    expect(hasPleskRuntimeMutationTarget({})).toBe(false);
    expect(assertNoPleskMigrationTarget({ env: {}, error })).toBe(true);
    expect(error).not.toHaveBeenCalled();
  });

  it("fails closed when the migration approval key exists with an empty value", () => {
    const error = vi.fn();

    expect(hasPleskMigrationTarget({ [MIGRATION_APPROVAL_ENV]: "" })).toBe(true);
    expect(
      assertNoPleskMigrationTarget({
        env: { [MIGRATION_APPROVAL_ENV]: "" },
        error,
      }),
    ).toBe(false);
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining(MIGRATION_APPROVAL_ENV),
    );
  });

  it("does not expose a non-empty migration target value", () => {
    const error = vi.fn();
    const target = "sensitive-migration-target";

    expect(
      assertNoPleskMigrationTarget({
        env: { [MIGRATION_APPROVAL_ENV]: target },
        error,
      }),
    ).toBe(false);
    expect(error.mock.calls.flat().join(" ")).not.toContain(target);
  });

  it("fails closed when the one-time reconciliation target is present, including when empty", () => {
    for (const target of ["", "private-target-value"]) {
      const error = vi.fn();
      const env = { [RECONCILIATION_APPROVAL_ENV]: target };

      expect(hasPleskRuntimeMutationTarget(env)).toBe(true);
      expect(assertNoPleskMigrationTarget({ env, error })).toBe(false);
      expect(error).toHaveBeenCalledWith(expect.stringContaining(RECONCILIATION_APPROVAL_ENV));
      expect(error.mock.calls.flat().join(" ")).not.toContain(target || "value-that-is-not-present");
    }
  });
});
