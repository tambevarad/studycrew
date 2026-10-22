import { redirect } from "next/navigation";
import { LinkButton } from "@/components/ui/button";
import { getSessionUser } from "@/server/session";

export default async function LandingPage() {
  if (await getSessionUser()) redirect("/dashboard");
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-6 px-6 py-24 text-center">
      <p className="rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-700">For student project teams</p>
      <h1 className="text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
        Plan together. Meet sooner. Miss nothing.
      </h1>
      <p className="max-w-xl text-lg text-slate-600">
        StudyCrew puts your team, calendar, task board, and shared notes in one place — and checks your draft against
        the assignment so you catch gaps before you submit.
      </p>
      <div className="flex gap-3">
        <LinkButton href="/sign-up" size="lg">
          Create an account
        </LinkButton>
        <LinkButton href="/sign-in" size="lg" variant="outline">
          Sign in
        </LinkButton>
      </div>
    </main>
  );
}
