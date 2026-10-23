import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local.");
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

/** The only Prisma client in the app. Import it from services, never from components. */
export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

/** A transaction client, for helpers that accept an optional `tx`. */
export type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];
export type DbOrTx = typeof db | Tx;
