import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import { hashPassword } from "../server/security";

neonConfig.webSocketConstructor = ws;

const LEGACY_TABLES = [
  "admin_users",
  "exam_calls",
  "students",
  "subjects",
  "teachers",
  "exam_schedules",
  "correlativities",
  "inscriptions",
  "maintenance_config",
  "permission_counter",
  "system_settings",
] as const;

type LegacyTable = (typeof LEGACY_TABLES)[number];

interface CopyBlock {
  columns: string[];
  rows: Array<Array<string | null>>;
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function decodeCopyValue(value: string): string | null {
  if (value === "\\N") return null;

  return value.replace(/\\(?:[0-7]{1,3}|x[0-9a-fA-F]{1,2}|.)/g, (escape) => {
    const code = escape.slice(1);
    if (/^[0-7]{1,3}$/.test(code)) {
      return String.fromCharCode(Number.parseInt(code, 8));
    }
    if (/^x[0-9a-fA-F]{1,2}$/.test(code)) {
      return String.fromCharCode(Number.parseInt(code.slice(1), 16));
    }

    const escapedCharacters: Record<string, string> = {
      b: "\b",
      f: "\f",
      n: "\n",
      r: "\r",
      t: "\t",
      v: "\v",
      "\\": "\\",
    };
    return escapedCharacters[code] ?? code;
  });
}

function parseCopyBlocks(sql: string): Map<LegacyTable, CopyBlock> {
  const allowedTables = new Set<string>(LEGACY_TABLES);
  const blocks = new Map<LegacyTable, CopyBlock>();
  const lines = sql.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(
      /^COPY public\.([a-z_]+) \(([^)]*)\) FROM stdin;$/,
    );
    if (!match) continue;

    const table = match[1];
    if (!allowedTables.has(table)) {
      throw new Error(`Unexpected table in dump: ${table}`);
    }
    if (blocks.has(table as LegacyTable)) {
      throw new Error(`Duplicate COPY block for table: ${table}`);
    }

    const columns = match[2]
      .split(",")
      .map((column) => column.trim().replace(/^"|"$/g, ""));
    const rows: Array<Array<string | null>> = [];

    index += 1;
    while (index < lines.length && lines[index] !== "\\.") {
      const values = lines[index].split("\t").map(decodeCopyValue);
      if (values.length !== columns.length) {
        throw new Error(
          `Invalid COPY row for ${table}: expected ${columns.length} values, received ${values.length}`,
        );
      }
      rows.push(values);
      index += 1;
    }

    if (index >= lines.length) {
      throw new Error(`Unterminated COPY block for table: ${table}`);
    }
    blocks.set(table as LegacyTable, { columns, rows });
  }

  for (const table of LEGACY_TABLES) {
    if (!blocks.has(table)) {
      throw new Error(`Missing COPY block for table: ${table}`);
    }
  }

  return blocks;
}

async function validateTargetSchema(
  pool: Pool,
  blocks: Map<LegacyTable, CopyBlock>,
): Promise<void> {
  const result = await pool.query<{ table_name: string; column_name: string }>(`
    select table_name, column_name
    from information_schema.columns
    where table_schema = 'public'
  `);
  const targetColumns = new Map<string, Set<string>>();
  for (const row of result.rows) {
    const columns = targetColumns.get(row.table_name) ?? new Set<string>();
    columns.add(row.column_name);
    targetColumns.set(row.table_name, columns);
  }

  for (const [table, block] of blocks) {
    const columns = targetColumns.get(table);
    if (!columns) throw new Error(`Target table does not exist: ${table}`);
    const missing = block.columns.filter((column) => !columns.has(column));
    if (missing.length > 0) {
      throw new Error(`Target table ${table} is missing: ${missing.join(", ")}`);
    }
  }

  for (const hardeningTable of ["user_sessions", "rate_limit_buckets"]) {
    if (!targetColumns.has(hardeningTable)) {
      throw new Error(`Target hardening table does not exist: ${hardeningTable}`);
    }
  }
}

async function hashLegacyPasswords(block: CopyBlock): Promise<number> {
  const passwordIndex = block.columns.indexOf("password");
  if (passwordIndex < 0) throw new Error("admin_users has no password column");

  let upgraded = 0;
  for (const row of block.rows) {
    const password = row[passwordIndex];
    if (password === null) throw new Error("admin_users contains a null password");
    if (/^\$2[aby]\$\d{2}\$/.test(password)) continue;
    row[passwordIndex] = await hashPassword(password);
    upgraded += 1;
  }
  return upgraded;
}

async function insertBlock(
  pool: Pool,
  table: LegacyTable,
  block: CopyBlock,
): Promise<void> {
  const batchSize = 100;
  const quotedColumns = block.columns.map(quoteIdentifier).join(", ");

  for (let offset = 0; offset < block.rows.length; offset += batchSize) {
    const batch = block.rows.slice(offset, offset + batchSize);
    const parameters: Array<string | null> = [];
    const values = batch.map((row) => {
      const placeholders = row.map((value) => {
        parameters.push(value);
        return `$${parameters.length}`;
      });
      return `(${placeholders.join(", ")})`;
    });

    await pool.query(
      `insert into ${quoteIdentifier(table)} (${quotedColumns}) values ${values.join(", ")}`,
      parameters,
    );
  }
}

async function resetSequence(pool: Pool, table: LegacyTable): Promise<void> {
  const quotedTable = quoteIdentifier(table);
  await pool.query(
    `select setval(
       pg_get_serial_sequence($1, 'id'),
       coalesce((select max(id) from ${quotedTable}), 1),
       exists(select 1 from ${quotedTable})
     )`,
    [`public.${table}`],
  );
}

async function main() {
  const connectionString = process.env.DATABASE_URL_DIRECT;
  const dumpPath = process.env.LEGACY_DUMP_PATH;
  if (!connectionString) throw new Error("DATABASE_URL_DIRECT must be configured");
  if (!dumpPath) throw new Error("LEGACY_DUMP_PATH must be configured");
  if (new URL(connectionString).hostname.includes("-pooler")) {
    throw new Error("DATABASE_URL_DIRECT must use a direct, non-pooled endpoint");
  }

  const sql = gunzipSync(readFileSync(dumpPath)).toString("utf8");
  const blocks = parseCopyBlocks(sql);
  const upgradedPasswords = await hashLegacyPasswords(blocks.get("admin_users")!);
  const pool = new Pool({ connectionString });

  try {
    await validateTargetSchema(pool, blocks);
    await pool.query("begin");
    await pool.query("set local statement_timeout = '5min'");
    await pool.query(
      `truncate table ${[
        ...LEGACY_TABLES,
        "user_sessions",
        "rate_limit_buckets",
      ]
        .map(quoteIdentifier)
        .join(", ")} restart identity cascade`,
    );

    for (const table of LEGACY_TABLES) {
      await insertBlock(pool, table, blocks.get(table)!);
      await resetSequence(pool, table);
    }

    const counts: Record<string, number> = {};
    for (const table of LEGACY_TABLES) {
      const result = await pool.query<{ count: string }>(
        `select count(*)::text as count from ${quoteIdentifier(table)}`,
      );
      counts[table] = Number(result.rows[0].count);
      if (counts[table] !== blocks.get(table)!.rows.length) {
        throw new Error(`Row count mismatch after import for ${table}`);
      }
    }
    await pool.query("commit");

    console.info(
      JSON.stringify({
        imported: counts,
        upgradedPasswords,
        clearedRuntimeTables: ["user_sessions", "rate_limit_buckets"],
      }),
    );
  } catch (error) {
    try {
      await pool.query("rollback");
    } catch {
      // The transaction may already be closed.
    }
    throw error;
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Legacy database import failed", error);
  process.exitCode = 1;
});
