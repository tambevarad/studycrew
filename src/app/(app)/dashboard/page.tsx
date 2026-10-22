import Link from "next/link";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { requirePageUser } from "@/server/session";
import { listMyTeams } from "@/server/shared/teams";
import { pluralize } from "@/lib/utils";

export const metadata = { title: "Home" };

/** Foundation version. PB-12 replaces this page with the personal home (my tasks, meetings, teams). */
export default async function DashboardPage() {
  const user = await requirePageUser();
  const teams = await listMyTeams(user.id);
  return (
    <>
      <PageHeader
        title={`Hi, ${user.name.split(" ")[0]}`}
        description="Your teams at a glance."
        actions={<LinkButton href="/teams/new">Create a team</LinkButton>}
      />
      {teams.length === 0 ? (
        <EmptyState
          title="You're not on a team yet"
          description="Create a team for your course, or search for one and ask to join."
          action={<LinkButton href="/teams">Find a team</LinkButton>}
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map((t) => (
            <li key={t.id}>
              <Link href={`/teams/${t.id}`} className="block rounded-lg focus-visible:outline-2">
                <Card className="h-full transition-shadow hover:shadow-md">
                  <CardBody className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-slate-900">{t.name}</span>
                      {t.role === "LEADER" ? <Badge tone="brand">Leader</Badge> : null}
                    </div>
                    <span className="text-sm text-slate-600">
                      {t.courseCode} · {pluralize(t.memberCount, "member")}
                    </span>
                  </CardBody>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
