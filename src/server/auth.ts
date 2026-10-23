import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { db } from "./db";

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
