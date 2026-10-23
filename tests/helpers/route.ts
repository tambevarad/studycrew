/**
 * Call a Next.js route handler directly:
 *   const res = await callRoute(POST, { params: { teamId }, body: { title: "x" } });
 *   expect(res.status).toBe(201);
 *   expect(res.json.data.title).toBe("x");
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Handler = (req: Request, ctx: { params: Promise<any> }) => Promise<Response>;

export async function callRoute(
  handler: Handler,
  opts: { method?: string; params?: Record<string, string>; body?: unknown; query?: Record<string, string> } = {},
) {
  const url = new URL("http://localhost/test");
  for (const [k, v] of Object.entries(opts.query ?? {})) url.searchParams.set(k, v);
  const req = new Request(url, {
    method: opts.method ?? (opts.body === undefined ? "GET" : "POST"),
    headers: opts.body === undefined ? undefined : { "content-type": "application/json" },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const res = await handler(req, { params: Promise.resolve(opts.params ?? {}) });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}
