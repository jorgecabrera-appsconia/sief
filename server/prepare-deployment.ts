import fs from "node:fs/promises";
import path from "node:path";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

async function main() {
  const connectionString = process.env.DATABASE_URL_DIRECT;
  if (!connectionString) {
    throw new Error("DATABASE_URL_DIRECT must be configured for migrations");
  }

  const migrationPath = path.resolve(
    import.meta.dirname,
    "..",
    "migrations",
    "0001_deployment_hardening.sql",
  );
  const migration = await fs.readFile(migrationPath, "utf8");
  const pool = new Pool({ connectionString });

  try {
    await pool.query(migration);
    console.info("Deployment hardening migration applied");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Deployment hardening migration failed", error);
  process.exitCode = 1;
});
