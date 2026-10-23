import { Avatar } from "@/components/ui/avatar";
import type { ActivityDTO } from "@/contracts/activity";
import { formatDateTime, relativeTime } from "@/lib/dates";
import { ActivityIcon } from "./activity-icon";

/** One history row: avatar, "Name did something", type icon, relative time with the exact time on hover. */
export function ActivityItem({ item, timeZone, now }: { item: ActivityDTO; timeZone: string; now?: Date }) {
  const name = item.actor?.name ?? "Someone";
  return (
    <li className="flex items-start gap-3 py-3">
      <Avatar name={name} />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-slate-800">
          <span className="font-medium text-slate-900">{name}</span> {item.summary}
        </p>
        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
          <ActivityIcon entityType={item.entityType} />
          <time dateTime={item.createdAt} title={formatDateTime(item.createdAt, timeZone)} suppressHydrationWarning>
            {relativeTime(item.createdAt, now, timeZone)}
          </time>
        </p>
      </div>
    </li>
  );
}
