import Link from "next/link";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-16">
      <Link href="/" className="mb-8 text-xl font-semibold tracking-tight text-brand-700">
        StudyCrew
      </Link>
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-surface p-6 shadow-sm">{children}</div>
    </main>
  );
}
