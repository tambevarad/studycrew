import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";
import { signInPathFor } from "@/lib/safe-next";

/**
 * D-01: send signed-out visitors of signed-in pages to `/sign-in?next=<where they were going>`, so an invite link,
 * a notification link, or a bookmark still works after signing in or signing up.
 *
 * Why here and not in `requirePageUser()`: the `(app)` layout redirects before the page renders, and a layout can't
 * see the URL (Next 16 docs, "Layouts do not ... access pathname"). Proxy runs before rendering and has the full URL.
 *
 * This is only an optimistic check: is there a session cookie at all? The real check stays in the `(app)` layout
 * (`requirePageUser()`) and in every service, so a forged or expired cookie gets no data, it just skips the `next`.
 */
export function proxy(request: NextRequest) {
  if (getSessionCookie(request)) return NextResponse.next();
  const { pathname, search } = request.nextUrl;
  return NextResponse.redirect(new URL(signInPathFor(pathname, search), request.url));
}

/**
 * Every top-level folder under `src/app/(app)/` (the signed-in area). Public pages ("/", sign-in, sign-up), API routes,
 * and static files are not matched. `tests/unit/proxy.test.ts` fails if a folder is added to `(app)/` without being
 * listed here.
 */
export const config = {
  matcher: [
    "/availability/:path*",
    "/dashboard/:path*",
    "/join/:path*",
    "/notifications/:path*",
    "/profile/:path*",
    "/teams/:path*",
  ],
};
