import { listNotificationsQuery } from "@/contracts/notifications";
import { authedRoute, parseQuery } from "@/server/http";
import { listNotifications } from "@/server/services/notifications/service";

export const GET = authedRoute(async ({ req, user }) =>
  listNotifications(user.id, parseQuery(req, listNotificationsQuery)),
);
