import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MeetingAgenda } from "@/components/features/agenda/meeting-agenda";
import { MeetingDetail } from "@/components/features/meetings/meeting-detail";
import { AppError } from "@/server/errors";
import { requirePageUser } from "@/server/session";
import { getMeeting, hasEnded, listTeamMembersForMeeting } from "@/server/services/meetings/service";

export const metadata = { title: "Meeting" };

/** PB-06 — meeting details, RSVPs, and the PB-15 agenda slot. */
export default async function MeetingPage({ params }: PageProps<"/teams/[teamId]/calendar/[meetingId]">) {
  const { teamId, meetingId } = await params;
  const user = await requirePageUser();
  const meeting = await getMeeting(teamId, user.id, meetingId).catch((err) => {
    if (err instanceof AppError && err.code === "NOT_FOUND") notFound();
    throw err;
  });
  const { members, myRole } = await listTeamMembersForMeeting(teamId, user.id);

  return (
    <div className="flex flex-col gap-4">
      <Link
        href={`/teams/${teamId}/calendar`}
        className="text-brand-700 inline-flex w-fit items-center gap-1 text-sm font-medium hover:underline"
      >
        <ChevronLeft className="size-4" aria-hidden /> Back to calendar
      </Link>
      <MeetingDetail
        meeting={meeting}
        members={members}
        timeZone={user.timezone}
        canManage={meeting.createdBy.id === user.id || myRole === "LEADER"}
        isPast={hasEnded(meeting)}
      />
      <MeetingAgenda teamId={teamId} meetingId={meetingId} />
    </div>
  );
}
