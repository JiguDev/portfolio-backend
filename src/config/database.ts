
import "dotenv/config";
import { Pool } from "pg";
import { readFileSync } from "node:fs";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not configured");
}

// Read Supabase Root CA certificate
const ca = readFileSync(
  new URL("../../certs/prod-ca-2021.crt", import.meta.url),
  "utf8"
);

// Remove SSL parameters that could override explicit TLS settings.
const databaseUrl = new URL(connectionString);

databaseUrl.searchParams.delete("sslmode");
databaseUrl.searchParams.delete("sslrootcert");
databaseUrl.searchParams.delete("sslcert");
databaseUrl.searchParams.delete("sslkey");

// Create a reusable PostgreSQL connection pool
export const pool = new Pool({
  connectionString: databaseUrl.toString(),

  ssl: {
    ca,
    rejectUnauthorized: true,
  },

  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

// Handle unexpected idle connection errors
pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL pool error:", error);
});
