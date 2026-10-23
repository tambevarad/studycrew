/**
 * PB-08 notifications: due-soon reminder appears once, bell updates by polling, clicking marks read and opens the link,
 * Mark all as read clears the badge; a11y (AC1, AC3, AC4, AC7).
 * Creates its own data through the PB-05 task API (needs PB-05 merged): a task assigned to Krish due in 2 h gives a
 * TASK_DUE_SOON reminder the next time the bell or page reads notifications.
 */
const bell = () => cy.get("a[href='/notifications'][aria-label^='Notifications']");
const label = (count: number) => (count > 0 ? `Notifications, ${count} unread` : "Notifications");

describe("PB-08 notifications", () => {
  const created: { teamId: string; taskId: string }[] = [];
  let teamId = "";
  let meId = "";

  /** A task assigned to Krish, due in a little over 2 h, created without touching the open page. */
  const createDueSoonTask = (title: string) =>
    cy
      .request("POST", `/api/v1/teams/${teamId}/tasks`, {
        title,
        assigneeIds: [meId],
        dueAt: new Date(Date.now() + 2 * 3_600_000 + 10 * 60_000).toISOString(),
      })
      .then((res) => created.push({ teamId, taskId: res.body.data.id }));

  beforeEach(() => {
    cy.login("krish");
    cy.request("/api/v1/me/profile").then((res) => (meId = res.body.data.id));
    cy.visitTeam();
    cy.location("pathname").then((path) => (teamId = path.split("/")[2]));
  });

  // Remove the tasks this spec created so the seeded board stays as other specs expect.
  after(() => {
    cy.login("krish");
    cy.then(() => created.forEach((t) => cy.request("DELETE", `/api/v1/teams/${t.teamId}/tasks/${t.taskId}`)));
    // Let Better Auth's sign-in rate limit (3 per 10 s) reset before the next spec
    // (docs/contract-requests/PB-05-e2e-sign-in-rate-limit.md).
    cy.wait(10_000);
  });

  it("AC1/AC3/AC7: a new reminder reaches the bell within one 60 s poll and appears exactly once", () => {
    const title = `E2E due ${Date.now()}`;
    cy.clock(Date.now(), ["setInterval"]); // fake only the bell's 60 s poll
    cy.visit("/dashboard");
    cy.request("/api/v1/me/notifications/unread-count").then((res) => {
      const count = res.body.data.count as number;
      bell().should("have.attr", "aria-label", label(count));
      createDueSoonTask(title); // no page load, so nothing on the page has read notifications since
      bell().should("have.attr", "aria-label", label(count));
      cy.tick(60_000);
      bell().should("have.attr", "aria-label", label(count + 1));
    });

    cy.visit("/notifications");
    cy.contains("li", `“${title}” is due in 2 h`).should("contain", "Unread:");
    cy.reload();
    cy.get("li").filter(`:contains("“${title}” is due in")`).should("have.length", 1);
    cy.checkPageA11y();
  });

  it("AC4: clicking a notification marks it read and opens its link; Mark all as read clears the badge", () => {
    const title = `E2E click ${Date.now()}`;
    createDueSoonTask(title);
    createDueSoonTask(`${title} B`);
    cy.visit("/notifications");
    cy.request("/api/v1/me/notifications/unread-count").then((res) => {
      const count = res.body.data.count as number;
      expect(count).to.be.at.least(2);
      bell().should("have.attr", "aria-label", label(count));

      cy.contains("li button", `“${title}” is due in`).click();
      cy.location("pathname").should("eq", `/teams/${teamId}/board`);
      cy.location("search").should("match", /^\?task=/);
      bell().should("have.attr", "aria-label", label(count - 1));
    });

    cy.visit("/notifications");
    cy.contains("li", `“${title}” is due in`).should("not.contain", "Unread:");
    cy.contains("a", "Unread").click();
    cy.location("search").should("eq", "?filter=unread");
    cy.contains("li", `“${title} B” is due in`).should("exist");
    cy.contains("li", `“${title}” is due in`).should("not.exist");
    cy.contains("button", "Mark all as read").click();
    bell().should("have.attr", "aria-label", "Notifications");
    cy.get("[data-testid=notification-badge]").should("not.exist");
    cy.reload();
    cy.contains("You're all caught up.").should("be.visible");
    // sonner's success toast is below 4.5:1 (docs/contract-requests/PB-02-toast-contrast.md); check without it.
    cy.get("[data-sonner-toast]", { timeout: 10000 }).should("not.exist");
    cy.checkPageA11y();
  });
});
