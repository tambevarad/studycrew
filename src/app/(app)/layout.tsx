import { Sidebar } from "@/components/app-shell/sidebar";
import { requirePageUser } from "@/server/session";
import { listMyTeams } from "@/server/shared/teams";

/** Authenticated shell. Everything under (app)/ requires a session. */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requirePageUser();
  const teams = await listMyTeams(user.id);
  return (
    <div className="flex min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">
        Skip to content
      </a>
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-slate-200 bg-surface md:block">
        <Sidebar user={{ name: user.name, email: user.email }} teams={teams} />
      </aside>
      <main id="main" className="min-w-0 flex-1 px-4 py-6 sm:px-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
