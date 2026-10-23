import { updateAvailabilityInput } from "@/contracts/availability";
import { authedRoute, parseBody } from "@/server/http";
import { getMyAvailability, setMyAvailability } from "@/server/services/availability/service";

export const GET = authedRoute(async ({ user }) => getMyAvailability(user.id));

export const PUT = authedRoute(async ({ req, user }) =>
  setMyAvailability(user.id, await parseBody(req, updateAvailabilityInput)),
);
