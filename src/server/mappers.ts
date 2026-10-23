import type { UserSummaryDTO } from "@/contracts/common";

/** Prisma `select` for anything that becomes a UserSummaryDTO. */
export const userSummarySelect = { id: true, name: true, email: true, image: true } as const;

export function toUserSummary(u: { id: string; name: string; email: string; image: string | null }): UserSummaryDTO {
  return { id: u.id, name: u.name, email: u.email, image: u.image };
}

export function iso(d: Date): string;
export function iso(d: Date | null | undefined): string | null;
export function iso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}
