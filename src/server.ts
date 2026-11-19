
import "dotenv/config";

import app from "./app.js";
import { pool } from "./config/database.js";

const PORT = Number(process.env.PORT ?? 5000);
const HOST = process.env.HOST ?? "0.0.0.0";

async function startServer(): Promise<void> {
  // Verify database connectivity before accepting traffic.
  await pool.query("SELECT 1");

  console.log("Database connection verified.");

  const server = app.listen(PORT, HOST, () => {
    console.log(`JiguDev Portfolio API is running`);
    console.log(`Local: http://localhost:${PORT}`);
    console.log(`Health: http://localhost:${PORT}/api/v1/health`);
    console.log(`DB Health: http://localhost:${PORT}/api/v1/health/db`);
  });

  const shutdown = (signal: string): void => {
    console.log(`${signal} received. Shutting down gracefully...`);

    server.close(async (error) => {
      if (error) {
        console.error("HTTP server shutdown error:", error);
        process.exitCode = 1;
      }

      try {
        await pool.end();
        console.log("Database pool closed.");
      } catch (poolError) {
        console.error("Database pool shutdown error:", poolError);
        process.exitCode = 1;
      }
    });
  };

  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));
}

startServer().catch(async (error: unknown) => {
  console.error("Failed to start Portfolio API:", error);

  try {
    await pool.end();
  } catch {
    // Ignore pool cleanup errors during startup failure.
  }

  process.exitCode = 1;
});