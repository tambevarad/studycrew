import { updateProfileInput } from "@/contracts/profile";
import { authedRoute, parseBody } from "@/server/http";
import { getProfile, updateProfile } from "@/server/services/profile/service";

export const GET = authedRoute(async ({ user }) => getProfile(user.id));

export const PATCH = authedRoute(async ({ req, user }) =>
  updateProfile(user.id, await parseBody(req, updateProfileInput)),
);
