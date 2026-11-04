/** PB-15 · FR-10 — agenda and help flags on the seeded meeting, which the seed always places in the future. */
const capture = (name: string, selector = "main") => {
  if (Cypress.expose("CAPTURE")) cy.get(selector).screenshot(name, { overwrite: true });
};

function waitForToastToClose(text: string) {
  cy.contains("[data-sonner-toast]", text, { timeout: 10000 }).should("not.exist");
}

function visitSeededMeeting() {
  cy.visitTeam("calendar");
  cy.location("pathname").then((calendarPath) => {
    const teamId = calendarPath.split("/")[2];
    const from = new Date(Date.now() - 86_400_000).toISOString();
    const to = new Date(Date.now() + 14 * 86_400_000).toISOString();
    cy.request(`/api/v1/teams/${teamId}/meetings?from=${from}&to=${to}`).then((res) => {
      const seeded = res.body.data.find((m: { title: string }) => m.title === "Sprint review and retro");
      expect(seeded, "seeded meeting").not.to.equal(undefined);
      cy.visit(`${calendarPath}/${seeded.id}`);
    });
  });
  cy.contains("h2", "Agenda");
}

function addTopic(title: string, notes?: string) {
  cy.get("input[name=title]").type(title);
  if (notes) cy.get("textarea[name=notes]").type(notes);
  cy.contains("button", "Add topic").click();
  cy.contains("Topic added");
  cy.contains("li", title);
  waitForToastToClose("Topic added");
}

const helpButton = (title: string) => cy.get(`[aria-label="I need help with this: ${title}"]`);

describe("PB-15 meeting agenda", () => {
  it("AC1/AC2: add topics, flag one, and it moves to the top — accessibly", () => {
    const stamp = Date.now();
    const first = `E2E first ${stamp}`;
    const second = `E2E second ${stamp}`;
    cy.login("krish");
    visitSeededMeeting();
    capture("PB-15-agenda-empty", "section[aria-labelledby=agenda-heading]");
    cy.checkPageA11y();

    cy.contains("button", "Add topic").click();
    cy.contains("Add a topic.").should("be.visible");

    addTopic(first, "Who presents the demo?");
    addTopic(second);
    cy.contains("li", first).should("contain", "Added by Krish").and("contain", "Who presents the demo?");

    helpButton(second).should("have.attr", "aria-pressed", "false").focus().click();
    helpButton(second).should("have.attr", "aria-pressed", "true");
    cy.contains("li", second).should("contain", "1 needs help");
    cy.get("section[aria-labelledby=agenda-heading] li").first().should("contain", second);
    helpButton(second).should("have.focus"); // keyboard users stay on the button after the list re-sorts
    capture("PB-15-agenda", "section[aria-labelledby=agenda-heading]");
    cy.checkPageA11y();

    helpButton(second).click();
    helpButton(second).should("have.attr", "aria-pressed", "false");
    cy.contains("li", second).should("not.contain", "needs help");
    cy.get("section[aria-labelledby=agenda-heading] li").then(($items) => {
      const titles = [...$items].map((li) => li.textContent ?? "");
      expect(titles.findIndex((t) => t.includes(first))).to.be.lessThan(titles.findIndex((t) => t.includes(second)));
    });

    for (const title of [first, second]) {
      cy.get(`[aria-label="Delete “${title}”"]`).click();
      cy.get("dialog[open]").contains("button", "Delete").click();
      cy.contains("li", title).should("not.exist");
    }
  });

  it("AC3: another member can't delete a topic, but a leader can", () => {
    const title = `E2E leader delete ${Date.now()}`;
    cy.login("krish");
    visitSeededMeeting();
    addTopic(title);

    cy.login("dev");
    visitSeededMeeting();
    cy.contains("li", title);
    cy.get(`[aria-label="Delete “${title}”"]`).should("not.exist");

    cy.login("varad");
    visitSeededMeeting();
    cy.get(`[aria-label="Delete “${title}”"]`).click();
    cy.get("dialog[open]").within(() => {
      cy.contains(`Delete “${title}”?`);
      cy.contains("button", "Delete").click();
    });
    cy.contains("li", title).should("not.exist");
    cy.contains("Topic deleted");
    waitForToastToClose("Topic deleted");
    cy.checkPageA11y();
  });
});
