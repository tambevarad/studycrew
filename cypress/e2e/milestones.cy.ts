/** PB-13: milestones from a template with a preview, linking tasks updates %, delete keeps tasks; a11y. */
const capture = (name: string, selector = "main") => {
  if (Cypress.expose("CAPTURE")) cy.get(selector).screenshot(name, { overwrite: true });
};

/** "YYYY-MM-DD" n days from today (local), for a date input. */
const dateIn = (days: number) => {
  const d = new Date(Date.now() + days * 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const card = (title: string) => cy.contains("h3", title).closest("section");
let teamId = "";

describe("PB-13 milestones and templates", () => {
  beforeEach(() => {
    cy.login("varad");
    cy.visitTeam("milestones");
    cy.location("pathname").then((path) => {
      teamId = path.split("/")[2];
    });
    cy.contains("h2", "Milestones");
  });

  after(() => {
    // Keep the seed's "Progress report" milestone; remove what this spec created (tasks stay, unlinked).
    cy.then(() =>
      cy.request(`/api/v1/teams/${teamId}/milestones`).then((res) => {
        for (const m of res.body.data as Array<{ id: string; title: string }>) {
          if (m.title !== "Progress report") cy.request("DELETE", `/api/v1/teams/${teamId}/milestones/${m.id}`);
        }
      }),
    );
  });

  it("AC2: the seeded milestone shows 1 of 2 tasks done (50%) with status badges, accessibly", () => {
    card("Progress report").within(() => {
      cy.contains("1 of 2 tasks done");
      cy.contains("50%");
      cy.get("[role=progressbar]").should("have.attr", "aria-valuenow", "50");
      cy.contains("li", "Draft architecture section").should("contain", "Done");
      cy.contains("li", "Write Cypress smoke test").should("contain", "Review");
    });
    cy.checkPageA11y();
  });

  it("AC1/AC4: Use a template shows a preview, then creates 5 milestones ending on the final date", () => {
    cy.contains("button", "Use a template").click();
    cy.get("dialog[open]").within(() => {
      cy.contains("h2", "Use a template");
      cy.get("select[name=templateKey]").select("Presentation (5 milestones)");
      cy.contains("Choose the final due date");
      cy.contains("button", "Create 5 milestones").should("be.disabled");
      cy.get("input[name=finalDueAt]").type(dateIn(21));
      cy.get("ol li").should("have.length", 5).first().should("contain", "1. Pick topic and split sections");
      cy.get("ol li").last().should("contain", "5. Final slides submitted");
    });
    cy.checkPageA11y();
    capture("PB-13-template-preview", "dialog[open]");

    cy.get("dialog[open]").contains("button", "Create 5 milestones").click();
    cy.contains("[data-sonner-toast]", "Added 5 milestones");
    cy.get("dialog[open]").should("not.exist");
    cy.get("ol[aria-label=Milestones] > li").should("have.length", 6);
    cy.get("ol[aria-label=Milestones] > li").last().should("contain", "Final slides submitted");
  });

  it("AC2: linking a Done and an In Progress task shows 50%; unlinking updates it", () => {
    card("Pick topic and split sections").within(() => {
      cy.contains("No tasks linked yet");
      cy.get("select").select("Set up CI pipeline");
      cy.contains("button", "Link").click();
      cy.contains("1 of 1 tasks done");
      cy.get("select").select("Design task board UI");
      cy.contains("button", "Link").click();
      cy.contains("1 of 2 tasks done");
      cy.contains("50%");
    });
    cy.get("[data-sonner-toast]", { timeout: 10000 }).should("not.exist");
    capture("PB-13-milestones");

    card("Pick topic and split sections").within(() => {
      cy.get("button[aria-label='Unlink “Set up CI pipeline”']").click();
      cy.contains("0 of 1 tasks done");
      cy.contains("0%");
    });
    cy.get("[data-sonner-toast]", { timeout: 10000 }).should("not.exist");
    cy.checkPageA11y();
  });

  it("AC3: deleting a milestone asks first and keeps its tasks on the board", () => {
    cy.get("button[aria-label='Delete “Pick topic and split sections”']").click();
    cy.get("dialog[open]").within(() => {
      cy.contains("h2", "Delete “Pick topic and split sections”?");
      cy.contains("Its 1 linked task stays on the board");
      cy.contains("button", "Delete").click();
    });
    cy.contains("h3", "Pick topic and split sections").should("not.exist");

    cy.then(() => cy.visit(`/teams/${teamId}/board`));
    cy.contains("li", "Design task board UI");
  });
});
