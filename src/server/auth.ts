import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { isValidTimeZone } from "@/contracts/common";
import { db } from "./db";

/**
 * `timezone` is accepted from the client on /api/auth/sign-up/email and /api/auth/update-user, which skip our Zod
 * contracts. An invalid zone would make every Intl/date-fns call that renders this user's times throw (including on
 * teammates' availability and meeting pages), so reject it here with the same message as `contracts/common#timeZone`.
 */
async function rejectInvalidTimeZone(user: Record<string, unknown>): Promise<void> {
  if (user.timezone !== undefined && (typeof user.timezone !== "string" || !isValidTimeZone(user.timezone))) {
    throw new APIError("BAD_REQUEST", { message: "Choose a valid time zone." });
  }
}

/**
 * Better Auth instance (email + password only, per scope). Mounted at /api/auth/*.
 * Cookies: HttpOnly, SameSite=Lax, and Secure in production (NFR-02).
 * Passwords are stored as salted scrypt hashes in Account.password (NFR-02).
 */
export const auth = betterAuth({
  appName: "StudyCrew",
  database: prismaAdapter(db, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    autoSignIn: true,
    // Email verification and password reset are out of scope (no email delivery).
    requireEmailVerification: false,
  },
  user: {
    additionalFields: {
      timezone: { type: "string", required: false, defaultValue: "America/Chicago", input: true },
    },
  },
  databaseHooks: {
    user: {
      create: { before: async (user) => rejectInvalidTimeZone(user) },
      update: { before: async (user) => rejectInvalidTimeZone(user) },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // refresh daily
  },
  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
    defaultCookieAttributes: { httpOnly: true, sameSite: "lax" },
  },
  plugins: [nextCookies()], // must stay last
});
