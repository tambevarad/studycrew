import type { NotificationTypeValue } from "@/contracts/notifications";
import { db, type DbOrTx } from "./db";

export interface NotifyInput {
  /** Recipients. Duplicates are removed; `exceptUserId` (usually the actor) is skipped. */
  userIds: string[];
  exceptUserId?: string | null;
  type: NotificationTypeValue;
  teamId?: string | null;
  title: string;
  body?: string | null;
  /** In-app path to open when clicked, e.g. `/teams/${teamId}/board`. */
  link?: string | null;
  /** Idempotency: same key for the same user is stored once (e.g. `due:${taskId}`). */
  dedupeKey?: string | null;
}

/**
 * Create in-app notifications (FR-05). Every feature calls this; PB-08 owns how they are shown.
 * Returns how many were created.
 */
export async function notify(input: NotifyInput, client: DbOrTx = db): Promise<number> {
  const recipients = [...new Set(input.userIds)].filter((id) => id !== input.exceptUserId);
  if (recipients.length === 0) return 0;
  const result = await client.notification.createMany({
    data: recipients.map((userId) => ({
      userId,
      teamId: input.teamId ?? null,
      type: input.type,
      title: input.title.slice(0, 200),
      body: input.body ?? null,
      link: input.link ?? null,
      dedupeKey: input.dedupeKey ?? null,
    })),
    skipDuplicates: true,
  });
  return result.count;
}
