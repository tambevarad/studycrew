"use client";

import type { ApiErrorBody } from "@/server/errors";

/** Thrown by apiFetch; `message` is already user-friendly and safe to show in a toast. */
export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fieldErrors: Record<string, string> = {},
  ) {
    super(message);
  }
}

/**
 * Typed fetch for /api/v1 from Client Components.
 *   const task = await apiFetch<TaskDTO>(`/api/v1/teams/${teamId}/tasks`, { method: "POST", body: input });
 */
export async function apiFetch<T>(
  path: string,
  init: { method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const res = await fetch(path, {
    method: init.method ?? "GET",
    headers: init.body === undefined ? undefined : { "Content-Type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: init.signal,
    credentials: "same-origin",
  });
  const json = (await res.json().catch(() => null)) as { data: T } | ApiErrorBody | null;
  if (!res.ok || !json || "error" in json) {
    const err = json && "error" in json ? json.error : null;
    const fields = (err?.details?.fields as Record<string, string> | undefined) ?? {};
    throw new ApiClientError(
      res.status,
      err?.code ?? "INTERNAL",
      err?.message ?? "We couldn't reach the server. Check your connection and try again.",
      fields,
    );
  }
  return json.data;
}
