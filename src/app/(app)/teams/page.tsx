import { Plus, Search } from "lucide-react";
import Link from "next/link";
import { InvitationsList, MyRequestsList } from "@/components/features/teams/my-invites-and-requests";
import { TeamCard } from "@/components/features/teams/team-card";
import { Alert } from "@/components/ui/alert";
import { Button, LinkButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Label } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { searchTeamsQuery } from "@/contracts/teams";
import { listMyInvites, listMyJoinRequests, myCourses, searchTeams } from "@/server/services/teams/service";
import { requirePageUser } from "@/server/session";

export const metadata = { title: "Find teams" };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function FindTeamsPage({ searchParams }: PageProps<"/teams">) {
  const user = await requirePageUser();
  const sp = await searchParams;
  const courses = await myCourses(user.id);
  const courseInput = first(sp.course).trim() || courses[0] || "";
  const q = first(sp.q).trim();
  const parsed = courseInput ? searchTeamsQuery.safeParse({ course: courseInput, q: q || undefined }) : null;
  const course = parsed?.success ? parsed.data.course : courseInput;

  const [results, invites, requests] = await Promise.all([
    parsed?.success ? searchTeams(user.id, parsed.data) : Promise.resolve([]),
    listMyInvites(user.id),
    listMyJoinRequests(user.id),
  ]);
  const createHref = course ? `/teams/new?course=${encodeURIComponent(course)}` : "/teams/new";

  return (
    <>
      <PageHeader
        title="Find teams"
        description="Search your course for a team to join, or start your own."
        actions={
          <LinkButton href={createHref}>
            <Plus aria-hidden />
            Create a team
          </LinkButton>
        }
      />

      <div className="flex flex-col gap-6">
        <InvitationsList invites={invites} timeZone={user.timezone} />
        <MyRequestsList requests={requests} timeZone={user.timezone} nowIso={new Date().toISOString()} />

        {/* A plain GET form: works without JavaScript, and the URL (?course=&q=) is shareable. */}
        <form role="search" aria-label="Search teams" action="/teams" method="get" className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="course">Course code</Label>
            <Input id="course" name="course" defaultValue={course} maxLength={20} placeholder="CSE 6324" className="w-40" />
          </div>
          <div className="flex min-w-48 flex-1 flex-col gap-1.5">
            <Label htmlFor="q">Team name (optional)</Label>
            <Input id="q" name="q" defaultValue={q} maxLength={80} placeholder="Filter by name" />
          </div>
          <Button type="submit" variant="secondary">
            <Search aria-hidden />
            Search
          </Button>
        </form>
        {courses.length > 1 ? (
          <p className="-mt-3 text-sm text-slate-600">
            Your courses:{" "}
            {courses.map((c, i) => (
              <span key={c}>
                {i > 0 ? " · " : ""}
                <Link href={`/teams?course=${encodeURIComponent(c)}`} className="text-brand-700 font-medium hover:underline">
                  {c}
                </Link>
              </span>
            ))}
          </p>
        ) : null}

        <section aria-labelledby="results-heading" className="flex flex-col gap-3">
          {!courseInput ? (
            <EmptyState
              title="Which course are you looking for?"
              description={
                <>
                  Type a course code above, or{" "}
                  <Link href="/profile" className="text-brand-700 font-medium hover:underline">
                    add your courses to your profile
                  </Link>{" "}
                  so we can search them for you.
                </>
              }
            />
          ) : parsed && !parsed.success ? (
            <Alert tone="danger">That doesn&apos;t look like a course code. Try something like CSE 6324.</Alert>
          ) : (
            <>
              <h2 id="results-heading" className="text-lg font-semibold text-slate-900">
                Teams in {course}
                {q ? <span className="font-normal text-slate-600"> matching “{q}”</span> : null}
              </h2>
              {results.length === 0 ? (
                <EmptyState
                  title={q ? `No teams in ${course} match “${q}”` : `No open teams for ${course} yet — create one.`}
                  description="Teams you start are listed here so classmates can ask to join."
                  action={<LinkButton href={createHref}>Create a team</LinkButton>}
                />
              ) : (
                <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label={`Teams in ${course}`}>
                  {results.map((t) => (
                    <li key={t.id} className="flex">
                      <TeamCard team={t} />
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
      </div>
    </>
  );
}
