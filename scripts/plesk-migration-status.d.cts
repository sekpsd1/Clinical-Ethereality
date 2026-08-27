export type SafeMigrationStatus = "ready" | "pending" | "failed";

export type SafeMigrationStatusArtifact = {
  version: 1;
  component: "migration_status";
  status: SafeMigrationStatus;
  migrationNames: string[];
  updatedAt: string;
};

export const MIGRATION_STATUS_RELATIVE_PATH: string;
export const SAFE_MIGRATION_STATUSES: readonly SafeMigrationStatus[];

export function writePleskMigrationStatus(input: {
  rootDir?: string;
  env?: NodeJS.ProcessEnv;
  nodeEnv?: string;
  fallbackRootDir?: string;
  status: SafeMigrationStatus;
  migrationNames: string[];
  now?: () => Date;
}): string;

export function readPleskMigrationStatus(input?: {
  rootDir?: string;
}): SafeMigrationStatusArtifact;
