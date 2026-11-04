/**
 * PB-17 · NFR-01 load test (k6). Pass: p95 < 800 ms and errors < 1 % for the app's own (non-AI) API calls,
 * at 100 virtual users for 5 minutes.
 *
 *   BASE_URL=https://studycrew-staging.vercel.app k6 run perf/load.js
 * with LOAD_TEST_PASSWORD already in the environment (from a hidden prompt, see perf/README.md; in CI, a repo secret).
 *
 * Needs the data from `perf/seed-load.ts` (10 users load-01…load-10@studycrew.test, 50 teams in "LOAD 9000").
 * Better Auth allows only ~3 sign-ins per 10 s per IP, so `setup()` signs each load user in ONCE (waiting out 429s)
 * and the 100 VUs share those 10 sessions. Sign-in calls are tagged `kind:auth` and are not part of the thresholds.
 *
 * Mix per iteration (weights): board 30 %, calendar 20 %, activity 20 %, notifications 20 %, create + move a task 10 %.
 * No AI endpoints (NFR-01 excludes them, and they would spend provider credits).
 */
import { check, fail, sleep } from "k6";
import http from "k6/http";
import { textSummary } from "https://jslib.k6.io/k6-summary/0.1.0/index.js";

const BASE = (__ENV.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const PASSWORD = __ENV.LOAD_TEST_PASSWORD;
const USERS = Number(__ENV.LOAD_USERS || 10);
const LOAD_COURSE = "LOAD 9000";

export const options = {
  setupTimeout: "4m",
  stages: [
    { duration: "30s", target: 100 },
    { duration: "5m", target: 100 },
    { duration: "15s", target: 0 },
  ],
  thresholds: {
    "http_req_duration{kind:api}": ["p(95)<800"],
    "http_req_failed{kind:api}": ["rate<0.01"],
    checks: ["rate>0.99"],
  },
};

const api = (name) => ({ tags: { kind: "api", name } });
const pad = (n) => String(n).padStart(2, "0");

function cookieHeader(res) {
  return Object.entries(res.cookies)
    .map(([name, values]) => `${name}=${values[0].value}`)
    .join("; ");
}

/** Signs one load user in, waiting out Better Auth's rate limit (X-Retry-After) up to 10 times. */
function signIn(email) {
  for (let attempt = 1; attempt <= 10; attempt++) {
    const res = http.post(`${BASE}/api/auth/sign-in/email`, JSON.stringify({ email, password: PASSWORD }), {
      headers: { "Content-Type": "application/json", Origin: BASE },
      tags: { kind: "auth" },
    });
    if (res.status === 200) return cookieHeader(res);
    if (res.status === 429) {
      sleep(Number(res.headers["X-Retry-After"] || 10) + 0.5);
      continue;
    }
    fail(`sign-in for ${email} failed with HTTP ${res.status}. Did perf/seed-load.ts run, with the same LOAD_TEST_PASSWORD?`);
  }
  fail(`sign-in for ${email} kept hitting the rate limit`);
}

export function setup() {
  if (!PASSWORD) fail("Set LOAD_TEST_PASSWORD (the one used with perf/seed-load.ts).");
  const sessions = [];
  for (let i = 1; i <= USERS; i++) {
    const cookie = signIn(`load-${pad(i)}@studycrew.test`);
    const res = http.get(`${BASE}/api/v1/teams?course=${encodeURIComponent(LOAD_COURSE)}`, {
      headers: { Cookie: cookie },
      tags: { kind: "auth" },
    });
    const teams = (res.json("data") || []).filter((t) => t.myRole !== null).map((t) => t.id);
    if (teams.length === 0) fail(`load-${pad(i)} is in no "${LOAD_COURSE}" team. Run perf/seed-load.ts first.`);
    sessions.push({ cookie, teams });
  }
  return { sessions };
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

export default function loadIteration(data) {
  const session = data.sessions[(__VU - 1) % data.sessions.length];
  const params = (name) => ({ ...api(name), headers: { Cookie: session.cookie, "Content-Type": "application/json" } });
  const teamId = pick(session.teams);
  const r = Math.random();

  if (r < 0.3) {
    const res = http.get(`${BASE}/api/v1/teams/${teamId}/tasks`, params("board"));
    check(res, { "board 200": (x) => x.status === 200 });
  } else if (r < 0.5) {
    const from = new Date(Date.now() - 3 * 86_400_000).toISOString();
    const to = new Date(Date.now() + 11 * 86_400_000).toISOString();
    const res = http.get(
      `${BASE}/api/v1/teams/${teamId}/meetings?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      params("calendar"),
    );
    check(res, { "calendar 200": (x) => x.status === 200 });
  } else if (r < 0.7) {
    const res = http.get(`${BASE}/api/v1/teams/${teamId}/activity?limit=30`, params("activity"));
    check(res, { "activity 200": (x) => x.status === 200 });
  } else if (r < 0.9) {
    const list = http.get(`${BASE}/api/v1/me/notifications?limit=30`, params("notifications"));
    const count = http.get(`${BASE}/api/v1/me/notifications/unread-count`, params("unread-count"));
    check(list, { "notifications 200": (x) => x.status === 200 });
    check(count, { "unread-count 200": (x) => x.status === 200 });
  } else {
    const created = http.post(
      `${BASE}/api/v1/teams/${teamId}/tasks`,
      JSON.stringify({ title: `k6 task ${__VU}-${__ITER}`, priority: "LOW" }),
      params("task-create"),
    );
    check(created, { "task created 201": (x) => x.status === 201 });
    if (created.status === 201) {
      const moved = http.post(
        `${BASE}/api/v1/teams/${teamId}/tasks/${created.json("data.id")}/move`,
        JSON.stringify({ status: pick(["IN_PROGRESS", "REVIEW", "DONE"]), index: 0 }),
        params("task-move"),
      );
      check(moved, { "task moved 200": (x) => x.status === 200 });
    }
  }
  sleep(1 + Math.random()); // think time
}

export function handleSummary(data) {
  return {
    stdout: textSummary(data, { indent: "  ", enableColors: false }),
    "perf/results/k6-summary.json": JSON.stringify(data, null, 2),
  };
}
