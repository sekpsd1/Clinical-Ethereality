/* eslint-disable @typescript-eslint/no-require-imports */
import { describe, expect, it, vi } from "vitest";
const { startPleskApplication } = require("../../scripts/plesk-application-startup.cjs");

function startupDependencies() {
  return {
    rootDir: "C:/approved-runtime",
    startStandalone: vi.fn(),
    assertMigrationTarget: vi.fn(() => true),
    assertRuntimeReady: vi.fn(),
    runZoomTestMigration: vi.fn(async () => ({
      requested: false,
      shouldStart: true,
      outcome: "not_requested"
    })),
    runZoomTestAccountBootstrap: vi.fn(async () => ({
      requested: false,
      shouldStart: true,
      outcome: "not_requested"
    })),
    runZoomTestFixture: vi.fn(async () => ({
      requested: false,
      shouldStart: true,
      outcome: "not_requested"
    })),
    runReconciliation: vi.fn(async () => ({
      outcome: "not_requested",
      shouldStart: true,
      reconciliationRun: false
    })),
    runMigration: vi.fn(() => ({ shouldStart: true, migrationRun: false }))
  };
}

describe("Plesk application startup integration", () => {
  it("keeps normal startup unchanged when no reconciliation is requested", async () => {
    const dependencies = startupDependencies();

    await startPleskApplication(dependencies);

    expect(dependencies.assertMigrationTarget).toHaveBeenCalledTimes(1);
    expect(dependencies.assertRuntimeReady).toHaveBeenCalledWith({ rootDir: dependencies.rootDir });
    expect(dependencies.runZoomTestMigration).toHaveBeenCalledWith({ rootDir: dependencies.rootDir });
    expect(dependencies.runZoomTestAccountBootstrap).toHaveBeenCalledWith({ rootDir: dependencies.rootDir });
    expect(dependencies.runZoomTestFixture).toHaveBeenCalledWith({ rootDir: dependencies.rootDir });
    expect(dependencies.runReconciliation).toHaveBeenCalledWith({ rootDir: dependencies.rootDir });
    expect(dependencies.runMigration).toHaveBeenCalledWith({ rootDir: dependencies.rootDir });
    expect(dependencies.startStandalone).toHaveBeenCalledTimes(1);
  });

  it("does not run the normal migration path or start the app after a reconciliation attempt", async () => {
    const dependencies = startupDependencies();
    dependencies.runReconciliation.mockResolvedValue({
      outcome: "completed",
      shouldStart: false,
      reconciliationRun: true
    });

    await expect(startPleskApplication(dependencies)).rejects.toThrow(
      "Plesk SMS OTP schema reconciliation did not authorize normal startup."
    );
    expect(dependencies.runMigration).not.toHaveBeenCalled();
    expect(dependencies.startStandalone).not.toHaveBeenCalled();
  });

  it("fails before reconciliation when the existing migration target guard rejects startup", async () => {
    const dependencies = startupDependencies();
    dependencies.assertMigrationTarget.mockReturnValue(false);

    await expect(startPleskApplication(dependencies)).rejects.toThrow(
      "Plesk migration target is not approved for this release."
    );
    expect(dependencies.assertRuntimeReady).not.toHaveBeenCalled();
    expect(dependencies.runZoomTestMigration).not.toHaveBeenCalled();
    expect(dependencies.runZoomTestAccountBootstrap).not.toHaveBeenCalled();
    expect(dependencies.runZoomTestFixture).not.toHaveBeenCalled();
    expect(dependencies.runReconciliation).not.toHaveBeenCalled();
    expect(dependencies.startStandalone).not.toHaveBeenCalled();
  });

  it("stops before runtime readiness after a requested Zoom Test migration action", async () => {
    const dependencies = startupDependencies();
    dependencies.runZoomTestMigration.mockResolvedValue({
      requested: true,
      shouldStart: false,
      outcome: "complete"
    });

    await expect(startPleskApplication(dependencies)).rejects.toThrow(
      "Zoom Test migration action completed or failed closed"
    );
    expect(dependencies.assertRuntimeReady).not.toHaveBeenCalled();
    expect(dependencies.runZoomTestAccountBootstrap).not.toHaveBeenCalled();
    expect(dependencies.runZoomTestFixture).not.toHaveBeenCalled();
    expect(dependencies.runReconciliation).not.toHaveBeenCalled();
    expect(dependencies.runMigration).not.toHaveBeenCalled();
    expect(dependencies.startStandalone).not.toHaveBeenCalled();
  });

  it("stops before runtime readiness after a requested Zoom Test account bootstrap action", async () => {
    const dependencies = startupDependencies();
    dependencies.runZoomTestAccountBootstrap.mockResolvedValue({
      requested: true,
      shouldStart: false,
      outcome: "complete"
    });

    await expect(startPleskApplication(dependencies)).rejects.toThrow(
      "Zoom Test account bootstrap action completed or failed closed"
    );
    expect(dependencies.assertRuntimeReady).not.toHaveBeenCalled();
    expect(dependencies.runReconciliation).not.toHaveBeenCalled();
    expect(dependencies.runMigration).not.toHaveBeenCalled();
    expect(dependencies.startStandalone).not.toHaveBeenCalled();
  });

  it("stops before runtime readiness after a requested Zoom Test fixture action", async () => {
    const dependencies = startupDependencies();
    dependencies.runZoomTestFixture.mockResolvedValue({
      requested: true,
      shouldStart: false,
      outcome: "complete"
    });

    await expect(startPleskApplication(dependencies)).rejects.toThrow(
      "Zoom Test fixture action completed or failed closed"
    );
    expect(dependencies.assertRuntimeReady).not.toHaveBeenCalled();
    expect(dependencies.runReconciliation).not.toHaveBeenCalled();
    expect(dependencies.runMigration).not.toHaveBeenCalled();
    expect(dependencies.startStandalone).not.toHaveBeenCalled();
  });
});
