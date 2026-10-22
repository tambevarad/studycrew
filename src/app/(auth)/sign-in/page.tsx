import { Suspense } from "react";
import { AuthForm } from "@/components/features/auth/auth-form";

export const metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <Suspense>
      <AuthForm mode="sign-in" />
    </Suspense>
  );
}
