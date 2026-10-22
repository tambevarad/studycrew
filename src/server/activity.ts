import type { ActivityTypeValue, EntityTypeValue } from "@/contracts/activity";
import { Prisma } from "@/generated/prisma/client";
import { db, type DbOrTx } from "./db";

export interface LogActivityInput {
  teamId: string;
  actorId: string | null;
  type: ActivityTypeValue;
  entityType: EntityTypeValue;
  entityId?: string | null;
  /** Short past-tense phrase WITHOUT the actor's name, e.g. `moved “Slides” to Done`. The UI prefixes the actor. */
  summary: string;
  metadata?: Record<string, unknown>;
}

/**
 * Append one entry to the team's activity history (FR-06).
 * Pass `tx` when inside a transaction so the log commits atomically with the change.
 */
export async function logActivity(input: LogActivityInput, client: DbOrTx = db): Promise<void> {
  await client.activityEvent.create({
    data: {
      teamId: input.teamId,
      actorId: input.actorId,
      type: input.type,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      summary: input.summary.slice(0, 300),
      metadata: (input.metadata as Prisma.InputJsonValue | undefined) ?? Prisma.JsonNull,
    },
  });
}
