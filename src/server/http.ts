import type { z } from "zod";
import { requireMembership, requireLeader, type Membership } from "./permissions";
import { requireUser, type SessionUser } from "./session";
import { toErrorResponse } from "./errors";

/**
 * Route handler helpers. Every /api/v1 route uses one of these so auth, the
 * response envelope, and error mapping are identical everywhere.
 *
 *   export const GET = authedRoute(async ({ user }) => getProfile(user.id));
 *   export const POST = teamRoute(async ({ req, params, user }) => {
 *     const input = await parseBody(req, createTaskInput);
 *     return created(await createTask(params.teamId, user.id, input));
 *   });
 *
 * Success: `{ data: ... }` (200, or 201 via created()). Errors: `{ error: { code, message, details? } }`.
 */

type Params = Record<string, string>;
interface RouteContext<P extends Params> {
  params: Promise<P>;
}

export interface AuthedArgs<P extends Params> {
  req: Request;
  params: P;
  user: SessionUser;
}

export interface TeamArgs<P extends Params> extends AuthedArgs<P & { teamId: string }> {
  membership: Membership;
}

class Created {
  constructor(public readonly data: unknown) {}
}

/** Return from a handler to respond 201 Created. */
export function created(data: unknown) {
  return new Created(data);
}

function toResponse(result: unknown): Response {
  if (result instanceof Response) return result;
  if (result instanceof Created) return Response.json({ data: result.data ?? null }, { status: 201 });
  return Response.json({ data: result ?? null }, { status: 200 });
}

export function authedRoute<P extends Params = Params>(fn: (args: AuthedArgs<P>) => Promise<unknown>) {
  return async (req: Request, ctx: RouteContext<P>): Promise<Response> => {
    try {
      const user = await requireUser();
      const params = await ctx.params;
      return toResponse(await fn({ req, params, user }));
    } catch (err) {
      return toErrorResponse(err);
    }
  };
}

/**
 * For any route under /api/v1/teams/[teamId]/…: checks membership (403 for
 * non-members, NFR-02) BEFORE your code runs. Use `{ leaderOnly: true }` for leader actions.
 */
export function teamRoute<P extends Params = Params>(
  fn: (args: TeamArgs<P>) => Promise<unknown>,
  opts: { leaderOnly?: boolean } = {},
) {
  return async (req: Request, ctx: RouteContext<P & { teamId: string }>): Promise<Response> => {
    try {
      const user = await requireUser();
      const params = await ctx.params;
      const membership = opts.leaderOnly
        ? await requireLeader(params.teamId, user.id)
        : await requireMembership(params.teamId, user.id);
      return toResponse(await fn({ req, params, user, membership }));
    } catch (err) {
      return toErrorResponse(err);
    }
  };
}

/** Parses a JSON body; throws ZodError (→ 400) when invalid. */
export async function parseBody<S extends z.ZodType>(req: Request, schema: S): Promise<z.output<S>> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    json = {};
  }
  return schema.parse(json);
}

/** Parses URL search params; throws ZodError (→ 400) when invalid. */
export function parseQuery<S extends z.ZodType>(req: Request, schema: S): z.output<S> {
  const url = new URL(req.url);
  return schema.parse(Object.fromEntries(url.searchParams.entries()));
}
