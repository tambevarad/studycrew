/**
 * PB-12 team overview and personal home on the seeded "StudyCrew Core" team (AC1, AC2, AC4, AC5).
 * Other specs add tasks to the same database, so expected numbers come from the dashboard API, not from the seed, and
 * nothing depends on today's date or weekday.
 */
type Dashboard = {
  totalTasks: number;
  doneTasks: number;
  completionPercent: number;
  overdueTasks: Array<{ id: string; title: string }>;
  dueSoonTasks: Array<{ id: string; title: string }>;
  upcomingMeetings: Array<{ id: string; title: string }>;
  openTasksPerMember: Array<{ user: { name: string }; open: number; overdue: number }>;
};

describe("PB-12 team dashboard and personal home", () => {
  it("AC1/AC2/AC4: the team overview matches the dashboard data, links overdue tasks to the board, and has text equivalents", () => {
    cy.login("varad");
    cy.visitTeam();
    cy.contains("h2", "Overview");
    cy.location("pathname").then((path) => {
      const teamId = path.split("/")[2];
      cy.request(`/api/v1/teams/${teamId}/dashboard`)
        .its("body.data")
        .then((d: Dashboard) => {
          cy.get("[data-testid=tile-completion]")
            .should("contain", `${d.completionPercent}%`)
            .and("contain", `${d.doneTasks} of ${d.totalTasks} tasks done`);
          cy.get("[data-testid=tile-open]").should("contain", String(d.totalTasks - d.doneTasks));
          cy.get("[data-testid=tile-overdue]").should("contain", String(d.overdueTasks.length));
          if (d.upcomingMeetings[0])
            cy.get("[data-testid=tile-next-meeting]").should("contain", d.upcomingMeetings[0].title);

          // AC2: every overdue task is listed and opens its card on the board.
          cy.get("section[aria-labelledby=overdue-heading] li").should("have.length", d.overdueTasks.length || 0);
          d.overdueTasks.forEach((t) => {
            cy.get("section[aria-labelledby=overdue-heading]")
              .contains("a", t.title)
              .should("have.attr", "href", `/teams/${teamId}/board?task=${t.id}`)
              .parents("li")
              .should("contain", "Overdue by");
          });

          // AC4: the workload chart has a table equivalent with every member, including members with 0.
          cy.contains("caption", "Open and overdue tasks per member")
            .parents("table")
            .within(() => {
              cy.get("tbody tr").should("have.length", d.openTasksPerMember.length);
              d.openTasksPerMember.forEach((r) => {
                cy.contains("th", r.user.name).parent("tr").find("td").eq(0).should("have.text", String(r.open));
                cy.contains("th", r.user.name).parent("tr").find("td").eq(1).should("have.text", String(r.overdue));
              });
            });
        });
    });
    // The charts render after hydration; check accessibility once they're on the page.
    cy.get("section[aria-labelledby=workload-heading] svg").should("exist");
    cy.checkPageA11y();
  });

  it("an overdue task's link opens it on the board", () => {
    cy.login("varad");
    cy.visitTeam();
    cy.get("section[aria-labelledby=overdue-heading] a").then(($links) => {
      if ($links.length === 0) return; // nothing overdue in this database state
      const title = $links.first().text();
      cy.wrap($links.first()).click();
      cy.location("pathname").should("match", /\/board$/);
      cy.get("dialog[open] input[name=title]").should("have.value", title);
    });
  });

  it("AC5: the personal home lists only my open tasks, across my teams", () => {
    cy.login("krish");
    cy.request("/api/auth/get-session").then((s) => {
      const meId = s.body.user.id as string;
      cy.visitTeam();
      cy.location("pathname").then((path) => {
        const teamId = path.split("/")[2];
        cy.request(`/api/v1/teams/${teamId}/tasks?assigneeId=${meId}`)
          .its("body.data")
          .then((tasks: Array<{ title: string; status: string }>) => {
            const open = tasks.filter((t) => t.status !== "DONE").map((t) => t.title);
            const done = tasks.filter((t) => t.status === "DONE").map((t) => t.title);
            cy.visit("/dashboard");
            cy.contains("h1", "Hi, Krish");
            cy.get("section[aria-labelledby=my-tasks-heading] li").should("have.length", open.length);
            open.forEach((title) => cy.get("section[aria-labelledby=my-tasks-heading]").should("contain", title));
            done.forEach((title) => cy.get("section[aria-labelledby=my-tasks-heading]").should("not.contain", title));
            cy.get("section[aria-labelledby=my-tasks-heading]").should("not.contain", "Draft architecture section");
          });
      });
    });
    cy.get("section[aria-labelledby=my-teams-heading]").should("contain", "StudyCrew Core");
    cy.checkPageA11y();
  });
});
