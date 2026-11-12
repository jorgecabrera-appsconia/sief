import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

async function main() {
  const connectionString = process.env.DATABASE_URL_DIRECT;
  if (!connectionString) {
    throw new Error("DATABASE_URL_DIRECT must be configured for inventory");
  }

  const pool = new Pool({ connectionString });
  try {
    const database = await pool.query(
      "select current_database() as database, current_schema() as schema",
    );
    const tablesResult = await pool.query<{ table_name: string }>(`
      select table_name
      from information_schema.tables
      where table_schema = 'public' and table_type = 'BASE TABLE'
      order by table_name
    `);
    const columns = await pool.query(`
      select table_name, column_name, data_type, is_nullable, column_default
      from information_schema.columns
      where table_schema = 'public'
      order by table_name, ordinal_position
    `);
    const constraints = await pool.query(`
      select tc.table_name, tc.constraint_name, tc.constraint_type,
             kcu.column_name, ccu.table_name as foreign_table_name,
             ccu.column_name as foreign_column_name
      from information_schema.table_constraints tc
      left join information_schema.key_column_usage kcu
        on tc.constraint_name = kcu.constraint_name
       and tc.table_schema = kcu.table_schema
      left join information_schema.constraint_column_usage ccu
        on tc.constraint_name = ccu.constraint_name
       and tc.table_schema = ccu.table_schema
      where tc.table_schema = 'public'
      order by tc.table_name, tc.constraint_name, kcu.ordinal_position
    `);

    const rowCounts: Record<string, number> = {};
    for (const { table_name: tableName } of tablesResult.rows) {
      const count = await pool.query<{ count: string }>(
        `select count(*)::text as count from ${quoteIdentifier(tableName)}`,
      );
      rowCounts[tableName] = Number(count.rows[0].count);
    }

    console.info(
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          connection: database.rows[0],
          rowCounts,
          columns: columns.rows,
          constraints: constraints.rows,
        },
        null,
        2,
      ),
    );
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Database inventory failed", error);
  process.exitCode = 1;
});
