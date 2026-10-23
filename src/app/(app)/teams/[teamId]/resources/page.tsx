import { ResourcesView } from "@/components/features/resources/resources-view";
import { RESOURCE_TYPES, type ResourceTypeValue } from "@/contracts/resources";
import { requireMembership } from "@/server/permissions";
import { requirePageUser } from "@/server/session";
import { listResources } from "@/server/services/resources/service";

export const metadata = { title: "Resources" };

/** PB-07 · FR-05 — shared notes, links, and file references. */
export default async function ResourcesPage({ params, searchParams }: PageProps<"/teams/[teamId]/resources">) {
  const { teamId } = await params;
  const sp = await searchParams;
  const user = await requirePageUser();
  const membership = await requireMembership(teamId, user.id);

  const type = RESOURCE_TYPES.includes(sp.type as ResourceTypeValue) ? (sp.type as ResourceTypeValue) : undefined;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  const resources = await listResources(teamId, user.id, { type, q: q || undefined });

  return (
    <ResourcesView
      teamId={teamId}
      resources={resources}
      me={{ id: user.id, isLeader: membership.role === "LEADER" }}
      timeZone={user.timezone}
      type={type ?? ""}
      q={q}
    />
  );
}
