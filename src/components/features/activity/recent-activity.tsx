/**
 * SLOT COMPONENT — owned by PB-09. PB-12's dashboard renders <RecentActivity teamId limit={5} />.
 * Server Component: lists the latest events with a link to the full history.
 */
import Link from "next/link";
import { requirePageUser } from "@/server/session";
import { listActivity } from "@/server/services/activity/service";
import { ActivityItem } from "./activity-item";

export async function RecentActivity({ teamId, limit = 5 }: { teamId: string; limit?: number }) {
  const user = await requirePageUser();
  const page = await listActivity(teamId, user.id, { limit });
  return (
    <div>
      {page.items.length === 0 ? (
        <p className="text-sm text-slate-500">No activity yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {page.items.map((item) => (
            <ActivityItem key={item.id} item={item} timeZone={user.timezone} />
          ))}
        </ul>
      )}
      <Link
        href={`/teams/${teamId}/activity`}
        className="text-brand-700 mt-2 inline-block text-sm font-medium hover:underline"
      >
        View all activity
      </Link>
    </div>
  );
}
