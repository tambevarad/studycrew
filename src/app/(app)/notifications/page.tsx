import { NotificationList } from "@/components/features/notifications/notification-list";
import { listNotifications, notificationTeamNames } from "@/server/services/notifications/service";
import { requirePageUser } from "@/server/session";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage({ searchParams }: PageProps<"/notifications">) {
  const user = await requirePageUser();
  const unreadOnly = (await searchParams).filter === "unread";
  const page = await listNotifications(user.id, { limit: 30, unreadOnly });
  const teamNames = await notificationTeamNames(user.id);
  return (
    <NotificationList
      initial={page}
      unreadOnly={unreadOnly}
      teamNames={teamNames}
      timeZone={user.timezone}
      nowIso={new Date().toISOString()}
    />
  );
}
