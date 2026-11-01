/** PB-11: run a check (mock model) → turn the Missing suggestion into a task → see it on the board; rate suggestions. */
const INSTRUCTIONS = `Your presentation must:
- Explain the benefits of social media with research examples
- Explain the drawbacks of social media with research examples
- Conclude with a recommendation for students
- Cite at least three peer-reviewed sources in APA format`;
const DRAFT = `Social media helps students stay connected. A 2021 study found benefits for research collaboration and examples of peer support.
We conclude with a recommendation that students limit late-night use.`;

const capture = (name: string, selector = "main") => {
  if (Cypress.expose("CAPTURE")) cy.get(selector).screenshot(name, { overwrite: true });
};

let teamId = "";
let reportId = "";
let taskId = "";

describe("PB-11 AI suggestion → task, and rating", () => {
  beforeEach(() => {
    cy.login("varad");
    cy.visitTeam("coverage");
    cy.location("pathname").then((path) => {
      teamId = path.split("/")[2];
    });
  });

  after(() => {
    // Leave the seed data as we found it for the other specs.
    if (taskId)
      cy.request({ method: "DELETE", url: `/api/v1/teams/${teamId}/tasks/${taskId}`, failOnStatusCode: false });
    if (reportId)
      cy.request({
        method: "DELETE",
        url: `/api/v1/teams/${teamId}/coverage-reports/${reportId}`,
        failOnStatusCode: false,
      });
  });

  it("AC1/AC2: Create task on a Missing item puts a High-priority task on the board, once", () => {
    cy.then(() =>
      cy.request("POST", `/api/v1/teams/${teamId}/coverage-reports`, {
        title: `E2E suggestion ${Date.now()}`,
        workType: "PRESENTATION",
        instructions: INSTRUCTIONS,
        draft: DRAFT,
        consent: true,
      }),
    ).then((res) => {
      reportId = res.body.data.id;
      cy.visit(`/teams/${teamId}/coverage/${reportId}`);
    });

    cy.contains("tr", "Cite at least three peer-reviewed sources").within(() => {
      cy.contains("Missing");
      cy.contains("button", "Create Task").click(); // visible "Task", accessible name "Create Task"
    });

    cy.get("dialog[open]").within(() => {
      cy.contains("h2", "Create a task from this suggestion");
      cy.contains("with High priority");
      cy.contains("label", "Krish Ruparel").find("input[type=checkbox]").check();
      cy.contains("label", "Due date (optional)");
    });
    cy.checkPageA11y();
    capture("PB-11-create-task-dialog", "dialog[open]");

    cy.intercept("POST", "**/coverage-items/*/task").as("createTask");
    cy.get("dialog[open]").contains("button", "Create task").click();
    cy.wait("@createTask").then(({ response }) => {
      expect(response?.statusCode).to.eq(201);
      taskId = response?.body.data.id;
    });
    cy.contains("[data-sonner-toast]", "Task created").should("contain", "View on board");
    cy.get("dialog[open]").should("not.exist");

    // The row now links to the task instead of offering a second one (AC1).
    cy.contains("tr", "Cite at least three peer-reviewed sources").within(() => {
      cy.contains("button", "Create Task").should("not.exist");
      cy.contains("a", "Open task").click();
    });

    // AC2: it is on the board, in To Do, with High priority and Krish assigned; ?task= opens it.
    cy.location("pathname").should("match", /\/board$/);
    cy.get("dialog[open]").within(() => {
      cy.get("input[name=title]").should(
        "have.value",
        "Add a section that covers: Cite at least three peer-reviewed sources in APA format.",
      );
      cy.contains("label", "Krish Ruparel").find("input[type=checkbox]").should("be.checked");
      cy.contains("button", "Cancel").click();
    });
    cy.get("dialog[open]").should("not.exist");
    cy.get("section[aria-labelledby='column-TODO']")
      .contains("li", "Add a section that covers: Cite at least three")
      .should("contain", "High")
      .and("contain", "KR");
  });

  it("AC3: Helpful / Not helpful is saved, survives a reload, and can be changed", () => {
    cy.then(() => cy.visit(`/teams/${teamId}/coverage/${reportId}`));
    cy.intercept("PUT", "**/coverage-items/*/rating").as("rate");

    cy.contains("tr", "drawbacks of social media").within(() => {
      cy.contains("Partial");
      cy.get("button[aria-label='Helpful']").should("have.attr", "aria-pressed", "false").click();
      cy.get("button[aria-label='Helpful']").should("have.attr", "aria-pressed", "true");
    });
    cy.wait("@rate").its("response.statusCode").should("eq", 200);

    cy.reload();
    cy.contains("tr", "drawbacks of social media").within(() => {
      cy.get("button[aria-label='Helpful']").should("have.attr", "aria-pressed", "true");
      cy.get("button[aria-label='Not helpful']").click();
      cy.get("button[aria-label='Not helpful']").should("have.attr", "aria-pressed", "true");
      cy.get("button[aria-label='Helpful']").should("have.attr", "aria-pressed", "false");
    });
    cy.wait("@rate").its("response.statusCode").should("eq", 200);

    // Covered rows can be rated but offer no task.
    cy.contains("tr", "Conclude with a recommendation").within(() => {
      cy.contains("button", "Create Task").should("not.exist");
      cy.get("button[aria-label='Helpful']").should("exist");
    });
    cy.checkPageA11y();
    capture("PB-11-report-actions");
  });
});
