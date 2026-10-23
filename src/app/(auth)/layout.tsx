import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/session";

/** Sign-in and sign-up pages. Already signed-in users go straight to their dashboard. */
export default async function AuthLayout({ children }: LayoutProps<"/">) {
  if (await getSessionUser()) redirect("/dashboard");
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-16">
      <Link href="/" className="text-brand-700 mb-8 text-xl font-semibold tracking-tight">
        StudyCrew
      </Link>
      <div className="bg-surface w-full max-w-sm rounded-lg border border-slate-200 p-6 shadow-sm">{children}</div>
    </main>
  );
}
