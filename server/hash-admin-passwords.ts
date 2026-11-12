import { adminUsers } from "@shared/schema";
import { eq } from "drizzle-orm";
import { db, pool } from "./db";
import { hashPassword } from "./security";

async function hashLegacyAdminPasswords() {
  const users = await db.select().from(adminUsers);
  let upgraded = 0;

  for (const user of users) {
    if (/^\$2[aby]\$\d{2}\$/.test(user.password)) continue;
    await db
      .update(adminUsers)
      .set({ password: await hashPassword(user.password) })
      .where(eq(adminUsers.id, user.id));
    upgraded += 1;
  }

  console.info(`Admin password migration complete: ${upgraded} upgraded`);
}

hashLegacyAdminPasswords()
  .then(() => pool.end())
  .catch(async (error) => {
    console.error("Admin password migration failed", error);
    await pool.end();
    process.exitCode = 1;
  });
