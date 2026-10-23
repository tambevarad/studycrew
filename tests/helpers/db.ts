import { db } from "@/server/db";

let tables: string[] | null = null;

/** Truncates every application table (keeps the migrations table). */
export async function resetDb(): Promise<void> {
  if (!tables) {
    const rows = await db.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
    tables = rows.map((r) => `"public"."${r.tablename}"`);
  }
  if (tables.length > 0) await db.$executeRawUnsafe(`TRUNCATE TABLE ${tables.join(", ")} RESTART IDENTITY CASCADE`);
}
