/** PB-07 · FR-05 — Shared notes, links, and file references (links only; no uploads). */
import { z } from "zod";
import type { UserSummaryDTO } from "./common";

export const RESOURCE_TYPES = ["NOTE", "LINK", "FILE_REF"] as const;
export type ResourceTypeValue = (typeof RESOURCE_TYPES)[number];

const httpUrl = z
  .url("Enter a full link starting with https://")
  .refine((u) => /^https?:\/\//i.test(u), "Links must start with http:// or https://");
const title = z.string().trim().min(1, "Give it a title.").max(150);

export const createResourceInput = z.discriminatedUnion("type", [
  z.object({ type: z.literal("NOTE"), title, body: z.string().trim().min(1, "Write something in the note.").max(10_000) }),
  z.object({ type: z.literal("LINK"), title, url: httpUrl }),
  z.object({ type: z.literal("FILE_REF"), title, url: httpUrl }),
]);
export type CreateResourceInput = z.infer<typeof createResourceInput>;

export const updateResourceInput = z.object({
  title: title.optional(),
  url: httpUrl.optional(),
  body: z.string().trim().max(10_000).optional(),
  pinned: z.boolean().optional(),
});
export type UpdateResourceInput = z.infer<typeof updateResourceInput>;

export const listResourcesQuery = z.object({
  type: z.enum(RESOURCE_TYPES).optional(),
  q: z.string().trim().max(80).optional(),
});
export type ListResourcesQuery = z.infer<typeof listResourcesQuery>;

export interface ResourceDTO {
  id: string;
  teamId: string;
  type: ResourceTypeValue;
  title: string;
  url: string | null;
  body: string | null;
  pinned: boolean;
  createdBy: UserSummaryDTO;
  createdAt: string;
  updatedAt: string;
}
