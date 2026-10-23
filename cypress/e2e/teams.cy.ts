/**
 * PB-04 teams: create → invite link → outsider joins by link; outsider asks to join "Query Optimizers" → maya approves.
 * The seed gives outsider a PENDING request to Query Optimizers; this spec cancels it, sends a new one, has maya approve
 * it, and `after()` restores the seed state (outsider leaves and re-requests) so the spec can run again.
 */
const SEED_MESSAGE = "I can help with SQL!";

function teamIdFromPath(path: string): string {
  return path.split("/")[2];
}

/**
 * Wait for a success toast to close before an axe check that follows a save (same pattern as auth.cy.ts). Keep this
 * after #29: the colors pass once a toast is fully shown, but it still fails axe while fading in (~350 ms).
 */
function waitForToastToClose(text: string) {
  cy.contains("[data-sonner-toast]", text, { timeout: 10000 }).should("not.exist");
}

/** Opens /teams?course=CSE 6324 and returns the result card for `name`. */
function teamCard(name: string) {
  cy.visit(`/teams?course=${encodeURIComponent("CSE 6324")}`);
  return cy.contains("ul[aria-label='Teams in CSE 6324'] > li", name);
}

describe("PB-04 teams, invites, and join requests", () => {
  let queryOptimizersId = "";

  after(() => {
    if (!queryOptimizersId) return;
    cy.login("outsider");
    cy.request({ method: "GET", url: "/api/v1/me/invites" }); // warm the session
    cy.request({ method: "GET", url: "/api/v1/me/profile" }).then(({ body }) => {
      const me = body.data.id as string;
      cy.request({ method: "DELETE", url: `/api/v1/teams/${queryOptimizersId}/members/${me}`, failOnStatusCode: false });
      cy.request({
        method: "POST",
        url: "/api/v1/join-requests",
        body: { teamId: queryOptimizersId, message: SEED_MESSAGE },
        failOnStatusCode: false,
      });
    });
  });

  it("AC1/AC2/AC10: creates a team, shares the invite link, and a classmate joins by link", () => {
    const name = `E2E Team ${Date.now()}`;
    cy.login("varad");
    cy.visit("/teams/new");
    cy.contains("h1", "Create a team");
    cy.checkPageA11y();

    cy.contains("button", "Create team").click();
    cy.contains("Team names need at least 2 characters.").should("be.visible");

    cy.get("input[name=name]").type(name);
    cy.get("input[name=courseCode]").clear().type("cse6324");
    cy.get("textarea[name=description]").type("Created by the PB-04 E2E spec.");
    cy.contains("button", "Create team").click();

    cy.location("pathname", { timeout: 15000 }).should("match", /^\/teams\/[^/]+\/members$/);
    cy.contains("Your team is ready. Share this link to invite teammates.").should("be.visible");
    cy.contains("header", "CSE 6324");
    cy.get("ul[aria-label='Team members']").should("contain", "Leader");
    cy.get("nav[aria-label='Main']").should("contain", name); // AC1: it's in my sidebar
    waitForToastToClose("Team created");
    cy.checkPageA11y();

    // AC6 in the browser: an email invite shows up on the invitee's Find teams page.
    cy.get("textarea[name=emails]").type("outsider@studycrew.test");
    cy.contains("button", "Send invites").click();
    cy.contains("Invited outsider@studycrew.test").should("be.visible");

    cy.contains("label", "Share this link")
      .invoke("attr", "for")
      .then((id) => cy.get(`#${id}`).invoke("val"))
      .then((link) => {
        const path = new URL(String(link)).pathname;
        expect(path).to.match(/^\/join\/[A-Za-z0-9_-]{10}$/);

        cy.login("outsider");
        // The invitation's date text is built on the server; the browser must hydrate it without a mismatch (#418).
        cy.visit("/teams", { onBeforeLoad: (win) => cy.spy(win.console, "error").as("consoleError") });
        cy.contains("h2", "Invitations")
          .closest("section")
          .within(() => {
            cy.contains(name);
            cy.contains(/Varad Tambe invited you · expires [A-Z][a-z]{2} \d{1,2}, \d{4}/);
          });
        cy.get("@consoleError").should("not.have.been.calledWithMatch", /hydrat|#418|#425/i);

        cy.visit(path);
        cy.contains("h1", `Join ${name}`);
        cy.contains("1 of 8 members");
        cy.checkPageA11y();
        cy.contains("button", "Join team").click();
        cy.location("pathname", { timeout: 15000 }).should("match", /^\/teams\/[^/]+$/);
        cy.contains("h1", name);

        // AC2: opening the link again is harmless.
        cy.visit(path);
        cy.contains("You're already a member of this team.").should("be.visible");
        cy.contains("a", "Open team").should("have.attr", "href").and("match", /^\/teams\//);
      });
  });

  it("AC3/AC4/AC5/AC10: outsider asks to join Query Optimizers and maya approves", () => {
    cy.login("outsider");
    teamCard("Query Optimizers").within(() => {
      cy.contains("Request pending"); // from the seed
      cy.contains("1 of 8 members");
    });
    cy.checkPageA11y();

    // Cancel the seeded request, then send a new one with a message.
    cy.get("button[aria-label='Cancel request to join Query Optimizers']").click();
    cy.contains("Request cancelled").should("be.visible");
    waitForToastToClose("Request cancelled");
    teamCard("Query Optimizers").within(() => cy.contains("button", "Ask to join").click());
    cy.get("dialog[open]").within(() => {
      cy.contains("h2", "Ask to join Query Optimizers");
      cy.get("textarea[name=message]").type("Happy to own the query planner experiments.");
    });
    cy.checkPageA11y();
    cy.get("dialog[open]").contains("button", "Send request").click();
    cy.contains("Request sent to Query Optimizers").should("be.visible");
    teamCard("Query Optimizers").should("contain", "Request pending");

    // maya leads Query Optimizers.
    cy.login("maya");
    teamCard("Query Optimizers")
      .find("a")
      .contains("Open team")
      .invoke("attr", "href")
      .then((href) => {
        queryOptimizersId = teamIdFromPath(String(href));
        cy.visit(`/teams/${queryOptimizersId}/members`);
      });
    cy.get("ul[aria-label='Pending join requests']").within(() => {
      cy.contains("Olivia Outsider");
      cy.contains("Happy to own the query planner experiments.");
    });
    cy.checkPageA11y();
    cy.get("button[aria-label='Approve Olivia Outsider']").click();
    cy.contains("Olivia Outsider joined the team").should("be.visible");
    cy.get("ul[aria-label='Team members']").should("contain", "Olivia Outsider");
    cy.contains("No pending requests.").should("be.visible");
  });

  it("AC8: the only leader can't leave, and the reason is shown", () => {
    cy.login("maya");
    teamCard("Query Optimizers")
      .find("a")
      .contains("Open team")
      .invoke("attr", "href")
      .then((href) => cy.visit(`${href}/members`));
    cy.contains("button", "Leave team").should("be.disabled");
    cy.contains("You're the only leader. Make someone else a leader before you leave").should("be.visible");
  });
});
