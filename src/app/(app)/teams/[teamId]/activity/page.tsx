import { ActivityFilters } from "@/components/features/activity/activity-filters";
import { ActivityTimeline } from "@/components/features/activity/activity-timeline";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/page-header";
import { ENTITY_TYPES, type EntityTypeValue } from "@/contracts/activity";
import { requirePageUser } from "@/server/session";
import { listActivity, listActivityFilterMembers, renderedAt } from "@/server/services/activity/service";

export const metadata = { title: "Activity" };

/** PB-09 · FR-06 — team activity history. */
export default async function ActivityPage({ params, searchParams }: PageProps<"/teams/[teamId]/activity">) {
  const { teamId } = await params;
  const sp = await searchParams;
  const user = await requirePageUser();

  const members = await listActivityFilterMembers(teamId, user.id);
  const actorParam = typeof sp.actor === "string" ? sp.actor : undefined;
  const entityParam = typeof sp.entity === "string" ? sp.entity : undefined;
  const actorId = actorParam && members.some((m) => m.id === actorParam) ? actorParam : undefined;
  const entityType = ENTITY_TYPES.includes(entityParam as EntityTypeValue)
    ? (entityParam as EntityTypeValue)
    : undefined;
  const filtered = Boolean(actorId || entityType);

  const page = await listActivity(teamId, user.id, { limit: 30, actorId, entityType });

  return (
    <div className="flex flex-col gap-5">
      <SectionHeader
        title="Activity"
        description="Everything your team has done, newest first. Times are in your time zone."
      />
      <ActivityFilters members={members} />
      {page.items.length === 0 ? (
        filtered ? (
          <EmptyState
            title="No matching activity"
            description="Try a different member or category, or clear the filters."
          />
        ) : (
          <EmptyState
            title="No activity yet"
            description="Create a task or schedule a meeting — every team action shows up here."
            action={<LinkButton href={`/teams/${teamId}/board`}>Go to the board</LinkButton>}
          />
        )
      ) : (
        <ActivityTimeline
          key={`${actorId ?? "all"}:${entityType ?? "all"}`}
          teamId={teamId}
          initial={page}
          timeZone={user.timezone}
          filters={{ actorId, entityType }}
          nowIso={renderedAt()}
        />
      )}
    </div>
  );
}
