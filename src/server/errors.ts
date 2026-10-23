import { ZodError } from "zod";

export type ErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "UPSTREAM"
  | "INTERNAL";

const STATUS: Record<ErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION: 400,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  UPSTREAM: 502,
  INTERNAL: 500,
};

/**
 * The single error type services throw. `message` is shown to end users, so
 * write it the way the UI lecture asks: polite, specific, and constructive
 * ("That team is full. Ask the leader to remove someone first."), never
 * "Error #27".
 */
export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
  }

  get status() {
    return STATUS[this.code];
  }
}

export const errors = {
  unauthenticated: () => new AppError("UNAUTHENTICATED", "Please sign in to continue."),
  forbidden: (message = "You don't have access to this team.") => new AppError("FORBIDDEN", message),
  notFound: (thing = "That item") => new AppError("NOT_FOUND", `${thing} could not be found. It may have been deleted.`),
  validation: (message: string, details?: Record<string, unknown>) => new AppError("VALIDATION", message, details),
  conflict: (message: string) => new AppError("CONFLICT", message),
  rateLimited: (message: string) => new AppError("RATE_LIMITED", message),
  upstream: (message: string) => new AppError("UPSTREAM", message),
};

export interface ApiErrorBody {
  error: { code: ErrorCode; message: string; details?: Record<string, unknown> };
}

/** Converts any thrown value into the standard JSON error response. */
export function toErrorResponse(err: unknown): Response {
  if (err instanceof AppError) {
    return Response.json(
      { error: { code: err.code, message: err.message, details: err.details } } satisfies ApiErrorBody,
      { status: err.status },
    );
  }
  if (err instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of err.issues) {
      const key = issue.path.join(".") || "_";
      fields[key] ??= issue.message;
    }
    return Response.json(
      {
        error: { code: "VALIDATION", message: "Some fields need attention.", details: { fields } },
      } satisfies ApiErrorBody,
      { status: 400 },
    );
  }
  const prismaCode = (err as { code?: string } | null)?.code;
  if (prismaCode === "P2025") return toErrorResponse(errors.notFound());
  if (prismaCode === "P2002") return toErrorResponse(errors.conflict("That already exists."));

  console.error("[api] unexpected error", err);
  return Response.json(
    {
      error: { code: "INTERNAL", message: "Something went wrong on our side. Please try again." },
    } satisfies ApiErrorBody,
    { status: 500 },
  );
}
