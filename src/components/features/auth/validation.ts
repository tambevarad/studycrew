/** Pure client-side checks for the auth form (PB-02). Better Auth re-checks everything on the server. */

export const MIN_PASSWORD = 8;

export type AuthFieldErrors = Partial<Record<"name" | "email" | "password", string>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateAuthFields(
  mode: "sign-in" | "sign-up",
  values: { name: string; email: string; password: string },
): AuthFieldErrors {
  const errors: AuthFieldErrors = {};
  if (mode === "sign-up" && !values.name.trim()) errors.name = "Enter your name.";
  if (!values.email.trim()) errors.email = "Enter your email.";
  else if (!EMAIL.test(values.email.trim())) errors.email = "Enter an email like you@school.edu.";
  if (!values.password) errors.password = "Enter your password.";
  else if (mode === "sign-up" && values.password.length < MIN_PASSWORD) {
    errors.password = `Use at least ${MIN_PASSWORD} characters.`;
  }
  return errors;
}

/** Seconds from Better Auth's `X-Retry-After` header (sent with 429), or null when missing or invalid. */
export function retryAfterSeconds(header: string | null | undefined): number | null {
  if (!header) return null;
  const seconds = Number(header);
  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : null;
}

/** 429 message with the real wait: "Too many attempts. Try again in 8 seconds." */
export function rateLimitMessage(seconds: number | null): string {
  if (seconds === null) return "Too many attempts. Wait a few seconds, then try again.";
  if (seconds < 60) return `Too many attempts. Try again in ${seconds} second${seconds === 1 ? "" : "s"}.`;
  const minutes = Math.ceil(seconds / 60);
  return `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}

/** Only same-site paths are allowed after sign-in, so `?next=` can't send people to another site. */
export function safeNextPath(raw: string | null): string | null {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return null;
  return raw;
}
