import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";
import { db } from "./db";
import { errors } from "./errors";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
  timezone: string;
}

/** Returns the signed-in user, or null. Safe to call from Server Components and route handlers. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, image: true, timezone: true },
  });
  return user;
}

/** For route handlers and services: throws 401 when signed out. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw errors.unauthenticated();
  return user;
}

/** For pages and layouts: redirects to /sign-in when signed out. */
export async function requirePageUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/sign-in");
  return user;
}
