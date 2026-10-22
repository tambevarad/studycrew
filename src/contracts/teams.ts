/** PB-04 · FR-02 — Teams, invites, course search, join requests, roles. */
import { z } from "zod";
import { courseCode, id, type UserSummaryDTO } from "./common";

export const TEAM_ROLES = ["LEADER", "MEMBER"] as const;
export type TeamRoleValue = (typeof TEAM_ROLES)[number];
export const MAX_TEAM_SIZE = 8;

export const createTeamInput = z.object({
  name: z.string().trim().min(2, "Team names need at least 2 characters.").max(80),
  courseCode,
  description: z.string().trim().max(500).optional(),
  isOpen: z.boolean().default(true),
});
export type CreateTeamInput = z.infer<typeof createTeamInput>;

export const updateTeamInput = createTeamInput.partial();
export type UpdateTeamInput = z.infer<typeof updateTeamInput>;

export const searchTeamsQuery = z.object({
  course: courseCode,
  q: z.string().trim().max(80).optional(),
});
export type SearchTeamsQuery = z.infer<typeof searchTeamsQuery>;

export const inviteByEmailInput = z.object({
  emails: z.array(z.email("Enter a valid email address.")).min(1).max(10),
});
export type InviteByEmailInput = z.infer<typeof inviteByEmailInput>;

export const joinRequestInput = z.object({
  message: z.string().trim().max(300).optional(),
});
export type JoinRequestInput = z.infer<typeof joinRequestInput>;

/** Body for POST /api/v1/join-requests (sent by a non-member, so it lives outside teams/[teamId]). */
export const createJoinRequestInput = joinRequestInput.extend({ teamId: id });
export type CreateJoinRequestInput = z.infer<typeof createJoinRequestInput>;

export const INVITE_TTL_DAYS = 14;

export const decideJoinRequestInput = z.object({
  decision: z.enum(["APPROVE", "DECLINE"]),
});
export type DecideJoinRequestInput = z.infer<typeof decideJoinRequestInput>;

export const changeRoleInput = z.object({ role: z.enum(TEAM_ROLES) });
export type ChangeRoleInput = z.infer<typeof changeRoleInput>;

export const memberParams = z.object({ teamId: id, userId: id });

export interface TeamSummaryDTO {
  id: string;
  name: string;
  courseCode: string;
  description: string | null;
  isOpen: boolean;
  memberCount: number;
  /** The viewer's role, or null if the viewer is not a member. */
  myRole: TeamRoleValue | null;
  /** True when the viewer has a PENDING join request for this team. */
  hasPendingRequest: boolean;
}

export interface TeamMemberDTO {
  user: UserSummaryDTO;
  role: TeamRoleValue;
  joinedAt: string;
}

export interface TeamDetailDTO extends TeamSummaryDTO {
  /** Only present for members; used to build /join/<inviteCode> links. */
  inviteCode: string | null;
  members: TeamMemberDTO[];
  createdAt: string;
}

export interface JoinRequestDTO {
  id: string;
  team: { id: string; name: string; courseCode: string };
  user: UserSummaryDTO;
  message: string | null;
  status: "PENDING" | "APPROVED" | "DECLINED" | "CANCELLED";
  createdAt: string;
  decidedAt: string | null;
}

export interface TeamInviteDTO {
  id: string;
  team: { id: string; name: string; courseCode: string };
  email: string;
  invitedBy: UserSummaryDTO;
  createdAt: string;
  expiresAt: string;
}
