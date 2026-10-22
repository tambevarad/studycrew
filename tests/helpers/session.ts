/**
 * Route-handler tests run without a browser session, so we mock src/server/session.
 * In a test file (vi.mock is hoisted above imports, so load the mock lazily — copy exactly):
 *
 *   import { signInAs, signOut } from "../helpers/session";
 *   vi.mock("@/server/session", async () => (await import("../helpers/session")).sessionMock);
 *   …
 *   signInAs(user);  // subsequent route calls run as this user
 */
import type { SessionUser } from "@/server/session";
import { errors } from "@/server/errors";

let current: SessionUser | null = null;

export function signInAs(user: { id: string; name: string; email: string; image?: string | null; timezone?: string }) {
  current = { id: user.id, name: user.name, email: user.email, image: user.image ?? null, timezone: user.timezone ?? "America/Chicago" };
}

export function signOut() {
  current = null;
}

export const sessionMock = {
  getSessionUser: async () => current,
  requireUser: async () => {
    if (!current) throw errors.unauthenticated();
    return current;
  },
  requirePageUser: async () => {
    if (!current) throw new Error("redirect:/sign-in");
    return current;
  },
};
