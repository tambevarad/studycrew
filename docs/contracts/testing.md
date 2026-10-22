# Testing contract

Quality targets from the proposal: CI green on every merge, **≥ 70% line coverage** on `src/server`, `src/contracts`,
`src/lib`; **100% of Must FRs covered by a passing E2E test**; zero serious/critical axe violations; AI tests never call a
real provider.

## What every backlog item must add

| Kind | Where | Tool | Required for |
|---|---|---|---|
| Unit | `tests/unit/<feature>.test.ts` | Vitest (no DB) | every pure function (meeting finder, slot math, scoring, quote check, position math, poll winner…) |
| Integration | `tests/integration/<feature>.test.ts` | Vitest + real Postgres | every exported service function **and** every route (status codes, envelope, permission rules, side effects: activity rows + notifications) |
| E2E | `cypress/e2e/<feature>.cy.ts` | Cypress + cypress-axe | the item's main user flow on a production build, ending with `cy.checkPageA11y()` |
| Authorization | automatic | `tests/integration/authz-sweep.test.ts` | nothing to write — it discovers your routes; it fails if you don't use `teamRoute()` |

Name tests after acceptance criteria so the traceability matrix can link them:
`it("AC2: a non-leader cannot approve a join request (403)", …)`.

## Integration tests — how

```ts
import { describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/v1/teams/[teamId]/tasks/route";
import { db } from "@/server/db";
import { makeTeam } from "../helpers/factories";
import { callRoute } from "../helpers/route";
import { signInAs } from "../helpers/session";

vi.mock("@/server/session", async () => (await import("../helpers/session")).sessionMock);

describe("PB-05 create task", () => {
  it("AC1: creates a task in To Do and logs activity", async () => {
    const { team, leader, members } = await makeTeam({ members: 1 });
    signInAs(leader);
    const res = await callRoute(POST, { params: { teamId: team.id }, body: { title: "Slides", assigneeIds: [members[0].id] } });
    expect(res.status).toBe(201);
    expect(res.json.data).toMatchObject({ title: "Slides", status: "TODO" });
    expect(await db.activityEvent.count({ where: { teamId: team.id, type: "TASK_CREATED" } })).toBe(1);
    expect(await db.notification.count({ where: { userId: members[0].id, type: "TASK_ASSIGNED" } })).toBe(1);
  });
});
```

- The database is wiped before **each test** (`tests/helpers/integration-setup.ts`). Build data with
  `tests/helpers/factories.ts` (`makeUser`, `makeTeam`, `makeTask`, `makeMeeting`). Need another factory? Put it in your
  own test file (helpers are shared/frozen).
- Use fixed dates (`new Date("2026-10-28T15:00:00Z")`) and pass `now` into services that depend on time. Don't
  `sleep`.
- `next/headers` is mocked globally; routes read the user from the session mock.

## E2E tests — how

```ts
describe("PB-05 task board", () => {
  beforeEach(() => cy.login("devarsh"));
  it("adds a task and moves it to Done", () => {
    cy.visitTeam("board");
    cy.contains("button", "New task").click();
    cy.get("input[name=title]").type(`E2E task ${Date.now()}`);
    // …
    cy.checkPageA11y();
  });
});
```

- Runs against `npm run build && npm run start` with the **seed** data (`prisma/seed.ts`). Seed users: `varad` (leader of
  StudyCrew Core), `krish`, `dev`, `devarsh` (members), `outsider` (no team), `maya` (leader of other teams).
- Specs share one database: create uniquely named data (`Date.now()`), don't depend on order, don't delete seed rows.
- Select by role/label/text (`cy.contains("button", "Save")`, `cy.get("[aria-label='…']")`), not CSS classes.

## AI feature

- Automated tests always get `MockCoverageModel` (`NODE_ENV=test`). Test the service's logic (quote verification,
  downgrade of unverified quotes, scoring, rate limit, timeout → 502, consent required) with the mock or a hand-written
  fake `CoverageModel` passed into the service.
- The 30-case evaluation set (PB-16) runs against the real provider manually via `npm run ai:eval`, never in CI.

## Nonfunctional (Sprint 5, PB-17)

k6 load test (NFR-01), OWASP ZAP baseline + `npm audit` (NFR-02), Lighthouse CI (NFR-03), usability test + SUS
(NFR-04), uptime monitor on `/api/health` (NFR-05). Scripts live in `perf/`, `security/`, and `docs/process/`.
