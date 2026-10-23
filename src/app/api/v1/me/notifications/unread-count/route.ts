import { authedRoute } from "@/server/http";
import { unreadCount } from "@/server/services/notifications/service";

export const GET = authedRoute(async ({ user }) => unreadCount(user.id));
