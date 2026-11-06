import "dotenv/config";

import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { PoolClient } from "pg";

import { pool } from "../src/config/database.js";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

const migrationsDirectory = path.resolve(
  currentDirectory,
  "../database/migrations"
);

const BASELINE_MIGRATIONS = [
  "001_extensions_and_types.sql",
  "002_identity_and_access.sql",
  "003_portfolios.sql",
  "004_templates.sql",
  "005_favourites_assets_resume.sql",
  "006_admin_audit_security.sql",
] as const;

// A fixed, application-specific PostgreSQL advisory lock identifier.
const MIGRATION_LOCK_ID = 2026110601;

type MigrationExecutionType = "baseline" | "executed";

interface MigrationFile {
  name: string;
  sql: string;
  checksum: string;
}

interface MigrationRecord {
  migration_name: string;
  checksum: string;
  execution_type: MigrationExecutionType;
  execution_time_ms: string;
  applied_at: Date;
}

function log(
  level: "info" | "success" | "error",
  message: string,
  details?: Record<string, unknown>
): void {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      message,
      ...details,
    })
  );
}

function calculateChecksum(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

async function ensureMigrationTable(): Promise<void> {
  await pool.query(`
    CREATE SCHEMA IF NOT EXISTS app_private;

    CREATE TABLE IF NOT EXISTS app_private.schema_migrations (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      migration_name TEXT NOT NULL UNIQUE,
      checksum CHAR(64) NOT NULL,
      execution_type TEXT NOT NULL,
      execution_time_ms BIGINT NOT NULL DEFAULT 0,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      CONSTRAINT schema_migrations_name_not_empty_chk
        CHECK (LENGTH(BTRIM(migration_name)) > 0),

      CONSTRAINT schema_migrations_checksum_chk
        CHECK (checksum ~ '^[a-f0-9]{64}$'),

      CONSTRAINT schema_migrations_execution_type_chk
        CHECK (execution_type IN ('baseline', 'executed')),

      CONSTRAINT schema_migrations_execution_time_chk
        CHECK (execution_time_ms >= 0)
    );
  `);
}

async function acquireMigrationLock(
  client: PoolClient
): Promise<void> {
  await client.query("SELECT pg_advisory_lock($1)", [
    MIGRATION_LOCK_ID,
  ]);
}

async function releaseMigrationLock(
  client: PoolClient
): Promise<void> {
  await client.query("SELECT pg_advisory_unlock($1)", [
    MIGRATION_LOCK_ID,
  ]);
}

async function loadMigrationFiles(): Promise<MigrationFile[]> {
  const entries = await readdir(migrationsDirectory, {
    withFileTypes: true,
  });

  const fileNames = entries
    .filter(
      (entry) =>
        entry.isFile() &&
        /^\d{3,}_[a-z0-9_-]+\.sql$/i.test(entry.name)
    )
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const migrations: MigrationFile[] = [];

  for (const name of fileNames) {
    const filePath = path.join(migrationsDirectory, name);
    const sql = await readFile(filePath, "utf8");

    if (!sql.trim()) {
      throw new Error(`Migration file is empty: ${name}`);
    }

    migrations.push({
      name,
      sql,
      checksum: calculateChecksum(sql),
    });
  }

  return migrations;
}

async function getMigrationRecords(): Promise<MigrationRecord[]> {
  const result = await pool.query<MigrationRecord>(`
    SELECT
      migration_name,
      checksum,
      execution_type,
      execution_time_ms,
      applied_at
    FROM app_private.schema_migrations
    ORDER BY migration_name;
  `);

  return result.rows;
}

function validateMigrationChecksums(
  migrations: MigrationFile[],
  records: MigrationRecord[]
): void {
  const appliedMap = new Map(
    records.map((record) => [record.migration_name, record])
  );

  for (const migration of migrations) {
    const applied = appliedMap.get(migration.name);

    if (applied && applied.checksum.trim() !== migration.checksum) {
      throw new Error(
        `Checksum mismatch for ${migration.name}. ` +
          "An already registered migration file has been modified. " +
          "Restore the original file or create a new migration."
      );
    }
  }
}

async function withMigrationLock(
  callback: (client: PoolClient) => Promise<void>
): Promise<void> {
  const client = await pool.connect();

  let lockAcquired = false;

  try {
    await acquireMigrationLock(client);
    lockAcquired = true;

    await callback(client);
  } finally {
    if (lockAcquired) {
      try {
        await releaseMigrationLock(client);
      } catch (error) {
        log("error", "Failed to release migration lock", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    client.release();
  }
}

async function baselineMigrations(): Promise<void> {
  const migrations = await loadMigrationFiles();

  const actualNames = migrations.map((migration) => migration.name);

  if (
    JSON.stringify(actualNames) !==
    JSON.stringify([...BASELINE_MIGRATIONS])
  ) {
    throw new Error(
      "Baseline stopped: migration files do not match the expected six migrations."
    );
  }

  await withMigrationLock(async (client) => {
    await client.query("BEGIN");

    try {
      const result = await client.query<{ count: string }>(`
        SELECT COUNT(*)::TEXT AS count
        FROM app_private.schema_migrations;
      `);

      if (Number(result.rows[0]?.count ?? 0) !== 0) {
        throw new Error(
          "Baseline stopped: migration history is not empty. " +
            "Existing migration records will not be overwritten."
        );
      }

      for (const migration of migrations) {
        await client.query(
          `
            INSERT INTO app_private.schema_migrations (
              migration_name,
              checksum,
              execution_type,
              execution_time_ms
            )
            VALUES ($1, $2, 'baseline', 0);
          `,
          [migration.name, migration.checksum]
        );

        log("success", "Migration baselined", {
          migration: migration.name,
          checksum: migration.checksum,
        });
      }

      await client.query("COMMIT");

      log("success", "Migration baseline completed", {
        count: migrations.length,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
}

async function runMigrations(): Promise<void> {
  const migrations = await loadMigrationFiles();

  await withMigrationLock(async (client) => {
    const records = await getMigrationRecords();

    validateMigrationChecksums(migrations, records);

    const appliedNames = new Set(
      records.map((record) => record.migration_name)
    );

    const pendingMigrations = migrations.filter(
      (migration) => !appliedNames.has(migration.name)
    );

    if (pendingMigrations.length === 0) {
      log("success", "Database is up to date", {
        applied: records.length,
        pending: 0,
      });

      return;
    }

    for (const migration of pendingMigrations) {
      const startedAt = Date.now();

      log("info", "Executing migration", {
        migration: migration.name,
      });

      await client.query("BEGIN");

      try {
        await client.query(migration.sql);

        const executionTime = Date.now() - startedAt;

        await client.query(
          `
            INSERT INTO app_private.schema_migrations (
              migration_name,
              checksum,
              execution_type,
              execution_time_ms
            )
            VALUES ($1, $2, 'executed', $3);
          `,
          [migration.name, migration.checksum, executionTime]
        );

        await client.query("COMMIT");

        log("success", "Migration completed", {
          migration: migration.name,
          executionTimeMs: executionTime,
        });
      } catch (error) {
        await client.query("ROLLBACK");

        log("error", "Migration failed and was rolled back", {
          migration: migration.name,
          error: error instanceof Error ? error.message : String(error),
        });

        throw error;
      }
    }
  });
}

async function showMigrationStatus(): Promise<void> {
  const migrations = await loadMigrationFiles();
  const records = await getMigrationRecords();

  validateMigrationChecksums(migrations, records);

  const appliedMap = new Map(
    records.map((record) => [record.migration_name, record])
  );

  for (const migration of migrations) {
    const record = appliedMap.get(migration.name);

    log(record ? "success" : "info", record ? "Applied" : "Pending", {
      migration: migration.name,
      executionType: record?.execution_type ?? null,
      appliedAt: record?.applied_at ?? null,
      executionTimeMs: record?.execution_time_ms ?? null,
    });
  }

  const knownNames = new Set(migrations.map((migration) => migration.name));

  for (const record of records) {
    if (!knownNames.has(record.migration_name)) {
      log("error", "Database contains a migration missing locally", {
        migration: record.migration_name,
      });
    }
  }

  log("info", "Migration status summary", {
    total: migrations.length,
    applied: records.length,
    pending: migrations.filter(
      (migration) => !appliedMap.has(migration.name)
    ).length,
  });
}

async function main(): Promise<void> {
  const command = process.argv[2] ?? "migrate";

  await ensureMigrationTable();

  switch (command) {
    case "baseline":
      await baselineMigrations();
      break;

    case "migrate":
      await runMigrations();
      break;

    case "status":
      await showMigrationStatus();
      break;

    default:
      throw new Error(
        `Unknown command "${command}". Use migrate, baseline or status.`
      );
  }
}

try {
  await main();
} catch (error) {
  log("error", "Migration command failed", {
    error: error instanceof Error ? error.message : String(error),
  });

  process.exitCode = 1;
} finally {
  await pool.end();
}