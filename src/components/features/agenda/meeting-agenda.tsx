/**
 * SLOT COMPONENT — owned by PB-15 (meeting agenda). PB-06's meeting page renders
 * <MeetingAgenda teamId meetingId /> below the meeting details. PB-15 replaces the body
 * (may become a Server Component that loads data, or wrap a client component); keep the
 * export name and props.
 */
export function MeetingAgenda(props: { teamId: string; meetingId: string }) {
  void props;
  return null;
}
