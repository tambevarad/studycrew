import { db } from "../db";

export interface MyTeamDTO {
  id: string;
  name: string;
  courseCode: string;
  role: "LEADER" | "MEMBER";
  memberCount: number;
}

/** Teams the user belongs to, for the sidebar/dashboard. Owned by foundation; PB-04 owns the full teams service. */
export async function listMyTeams(userId: string): Promise<MyTeamDTO[]> {
  const rows = await db.teamMember.findMany({
    where: { userId },
    orderBy: { joinedAt: "asc" },
    select: {
      role: true,
      team: { select: { id: true, name: true, courseCode: true, _count: { select: { members: true } } } },
    },
  });
  return rows.map((r) => ({
    id: r.team.id,
    name: r.team.name,
    courseCode: r.team.courseCode,
    role: r.role,
    memberCount: r.team._count.members,
  }));
}

export async function getTeamHeader(teamId: string) {
  return db.team.findUnique({
    where: { id: teamId },
    select: { id: true, name: true, courseCode: true, description: true, isOpen: true },
  });
}
