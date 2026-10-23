"use client";

/**
 * Owned by PB-02. Foundation ships a working minimal version so everyone can sign in
 * while building; PB-02 polishes validation, messages, and tests.
 */
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { signIn, signUp } from "@/lib/auth-client";

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const result =
      mode === "sign-in"
        ? await signIn.email({ email, password })
        : await signUp.email({
            email,
            password,
            name: String(form.get("name") ?? "").trim(),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          } as Parameters<typeof signUp.email>[0]);
    setPending(false);
    if (result.error) {
      setError(
        mode === "sign-in"
          ? "That email and password don't match. Check them and try again."
          : (result.error.message ?? "We couldn't create your account. Please try again."),
      );
      return;
    }
    router.push(params.get("next") ?? "/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate={false}>
      <h1 className="text-xl font-semibold text-slate-900">{mode === "sign-in" ? "Sign in" : "Create your account"}</h1>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {mode === "sign-up" ? (
        <FormField label="Full name" required>
          <Input name="name" autoComplete="name" maxLength={80} />
        </FormField>
      ) : null}
      <FormField label="Email" required>
        <Input name="email" type="email" autoComplete="email" />
      </FormField>
      <FormField label="Password" required hint={mode === "sign-up" ? "At least 8 characters." : undefined}>
        <Input
          name="password"
          type="password"
          minLength={8}
          autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
        />
      </FormField>
      <Button type="submit" loading={pending} className="w-full">
        {mode === "sign-in" ? "Sign in" : "Create account"}
      </Button>
      <p className="text-center text-sm text-slate-600">
        {mode === "sign-in" ? (
          <>
            New here?{" "}
            <Link href="/sign-up" className="font-medium text-brand-700 hover:underline">
              Create an account
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link href="/sign-in" className="font-medium text-brand-700 hover:underline">
              Sign in
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
