import { markReadInput } from "@/contracts/notifications";
import { authedRoute, parseBody } from "@/server/http";
import { markRead } from "@/server/services/notifications/service";

export const POST = authedRoute(async ({ req, user }) => markRead(user.id, await parseBody(req, markReadInput)));
