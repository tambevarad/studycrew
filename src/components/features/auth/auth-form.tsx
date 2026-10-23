"use client";

/**
 * PB-02 · FR-01 — sign-in and sign-up form on top of Better Auth (`/api/auth/*`).
 * Validates on the client so errors appear under each field, then maps Better Auth errors to friendly messages.
 */
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { signIn, signUp } from "@/lib/auth-client";
import {
  MIN_PASSWORD,
  rateLimitMessage,
  retryAfterSeconds,
  safeNextPath,
  validateAuthFields,
  type AuthFieldErrors,
} from "./validation";

type Mode = "sign-in" | "sign-up";

function passwordHint(mode: Mode, length: number): string | undefined {
  if (mode === "sign-in") return undefined;
  if (length === 0) return `At least ${MIN_PASSWORD} characters.`;
  const missing = MIN_PASSWORD - length;
  return missing > 0 ? `${missing} more character${missing === 1 ? "" : "s"} needed.` : "Length looks good.";
}

/** Password field with a show/hide toggle; forwards FormField's id and aria props to the real input. */
function PasswordInput({
  id,
  autoComplete,
  value,
  onChange,
  ...aria
}: {
  id?: string;
  autoComplete: string;
  value: string;
  onChange: (v: string) => void;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        name="password"
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        maxLength={128}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={aria["aria-describedby"]}
        aria-invalid={aria["aria-invalid"]}
        className="pr-11"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 inline-flex w-10 items-center justify-center rounded-r-md text-slate-500 hover:text-slate-800"
      >
        {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
      </button>
    </div>
  );
}

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNextPath(params.get("next"));
  const formRef = useRef<HTMLFormElement>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});
  const [error, setError] = useState<ReactNode>(null);
  const [pending, setPending] = useState(false);
  const otherHref = (path: string) => (next ? `${path}?next=${encodeURIComponent(next)}` : path);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const errs = validateAuthFields(mode, { name, email, password });
    setFieldErrors(errs);
    const firstInvalid = (["name", "email", "password"] as const).find((f) => errs[f]);
    if (firstInvalid) {
      formRef.current?.querySelector<HTMLInputElement>(`input[name=${firstInvalid}]`)?.focus();
      return;
    }

    setPending(true);
    // `result.error` has no headers, so read Better Auth's X-Retry-After (sent with 429) from the response here.
    let retryAfter: string | null = null;
    const fetchOptions = {
      onError: (ctx: { response: Response }) => {
        retryAfter = ctx.response.headers.get("x-retry-after");
      },
    };
    const result =
      mode === "sign-in"
        ? await signIn.email({ email: email.trim(), password, fetchOptions })
        : await signUp.email({
            email: email.trim(),
            password,
            name: name.trim(),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            fetchOptions,
          } as Parameters<typeof signUp.email>[0]);

    if (result.error) {
      setPending(false);
      const code = result.error.code ?? "";
      if (mode === "sign-up" && code.startsWith("USER_ALREADY_EXISTS")) {
        setError(
          <>
            An account with that email already exists.{" "}
            <Link href={otherHref("/sign-in")} className="font-medium underline">
              Sign in instead?
            </Link>
          </>,
        );
      } else if (mode === "sign-in" && (code === "INVALID_EMAIL_OR_PASSWORD" || result.error.status === 401)) {
        setError("That email and password don't match. Check them and try again.");
      } else if (result.error.status === 429) {
        setError(rateLimitMessage(retryAfterSeconds(retryAfter)));
      } else {
        setError(
          mode === "sign-in"
            ? "We couldn't sign you in right now. Please try again."
            : "We couldn't create your account right now. Please try again.",
        );
      }
      return;
    }
    // Keep the button disabled while the next page loads.
    router.push(next ?? (mode === "sign-in" ? "/dashboard" : "/profile?welcome=1"));
    router.refresh();
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <h1 className="text-xl font-semibold text-slate-900">{mode === "sign-in" ? "Sign in" : "Create your account"}</h1>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {mode === "sign-up" ? (
        <FormField label="Full name" required error={fieldErrors.name}>
          <Input
            name="name"
            autoComplete="name"
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </FormField>
      ) : null}
      <FormField label="Email" required error={fieldErrors.email}>
        <Input
          name="email"
          type="email"
          autoComplete="email"
          maxLength={254}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </FormField>
      <FormField label="Password" required hint={passwordHint(mode, password.length)} error={fieldErrors.password}>
        <PasswordInput
          autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
          value={password}
          onChange={setPassword}
        />
      </FormField>
      <Button type="submit" loading={pending} className="w-full">
        {mode === "sign-in" ? "Sign in" : "Create account"}
      </Button>
      <p className="text-center text-sm text-slate-600">
        {mode === "sign-in" ? (
          <>
            New here?{" "}
            <Link href={otherHref("/sign-up")} className="text-brand-700 font-medium hover:underline">
              Create an account
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link href={otherHref("/sign-in")} className="text-brand-700 font-medium hover:underline">
              Sign in
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
