import {
  CalendarDays,
  CheckSquare,
  Flag,
  Link2,
  Settings,
  Sparkles,
  UserRound,
  Vote,
  type LucideIcon,
} from "lucide-react";
import type { EntityTypeValue } from "@/contracts/activity";

const ICONS: Record<EntityTypeValue, LucideIcon> = {
  task: CheckSquare,
  meeting: CalendarDays,
  resource: Link2,
  coverage: Sparkles,
  milestone: Flag,
  poll: Vote,
  member: UserRound,
  team: Settings,
};

export function ActivityIcon({ entityType }: { entityType: EntityTypeValue }) {
  const Icon = ICONS[entityType] ?? Settings;
  return <Icon className="size-3.5 text-slate-500" aria-hidden />;
}
