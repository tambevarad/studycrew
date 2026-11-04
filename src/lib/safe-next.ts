/**
 * `?next=` handling for sign-in redirects (D-01). Shared by the proxy (which adds `next`) and the auth form (which
 * follows it), so both agree on what is safe.
 *
 * A `next` value is only followed when it resolves to a path on THIS site. Checking that the string starts with "/" is
 * not enough: browsers strip tabs and newlines from URLs, so "/\t/evil.com" becomes "//evil.com" (another site), and
 * "/\evil.com" is treated like "//evil.com" too. So we resolve the value against a placeholder origin and require the
 * origin to stay the same.
 */
const PLACEHOLDER_ORIGIN = "http://studycrew.invalid";

/** The path to send someone to after signing in, or null when `raw` could leave the site (open redirect). */
export function safeNextPath(raw: string | null | undefined): string | null {
  if (!raw || raw.length > 2048 || !raw.startsWith("/")) return null;
  // Control characters and backslashes never belong in our paths (browsers rewrite them, see above).
  for (const ch of raw) {
    const code = ch.charCodeAt(0);
    if (code < 0x20 || code === 0x7f || ch === "\\") return null;
  }
  let url: URL;
  try {
    url = new URL(raw, PLACEHOLDER_ORIGIN);
  } catch {
    return null;
  }
  if (url.origin !== PLACEHOLDER_ORIGIN) return null;
  // Dot segments can normalize to a protocol-relative path: "/..//evil.com" → "//evil.com", which leaves the site.
  if (url.pathname.startsWith("//")) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}

/** `/sign-in?next=<path>` for a signed-out visitor to `pathname` (+ `search`), or plain `/sign-in` if it isn't safe. */
export function signInPathFor(pathname: string, search = ""): string {
  const next = safeNextPath(`${pathname}${search}`);
  return next ? `/sign-in?next=${encodeURIComponent(next)}` : "/sign-in";
}
