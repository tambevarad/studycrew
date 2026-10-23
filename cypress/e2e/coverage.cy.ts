/**
 * PB-10 · FR-07 — AI Coverage Check on the seeded "StudyCrew Core" team, with the mock model (CI sets AI_PROVIDER=mock).
 * `npx cypress run --spec cypress/e2e/coverage.cy.ts --expose CAPTURE=1` also saves the screenshots used in the PR
 * and the report (copied to docs/screenshots/PB-10-*.png). Element screenshots, so the sticky sidebar isn't repeated.
 */
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

function fillForm(title: string) {
  cy.get("input[name=title]").type(title);
  cy.get("select[name=workType]").select("Presentation");
  // Pasting, not typing: these are long and typing them is slow.
  cy.get("textarea[name=instructions]").invoke("val", INSTRUCTIONS).trigger("input");
  cy.get("textarea[name=instructions]").type(" ");
  cy.get("textarea[name=draft]").invoke("val", DRAFT).trigger("input");
  cy.get("textarea[name=draft]").type(" ");
}

// The manual failure capture runs alone: these tests need the mock provider.
(Cypress.expose("CAPTURE_FAILURE") ? describe.skip : describe)("PB-10 AI Coverage Check", () => {
  beforeEach(() => cy.login("devarsh"));

  it("AC1/AC3/AC10: paste instructions + draft, consent, run with the mock, see a Missing item — accessibly", () => {
    const title = `E2E check ${Date.now()}`;
    cy.visitTeam("coverage");
    cy.contains("h2", "AI Coverage Check");
    cy.contains("AI can miss or invent gaps. Treat results as suggestions; StudyCrew never writes your assignment.");
    cy.contains(/\d+ of 10 checks left today/);
    cy.checkPageA11y();

    fillForm(title);
    cy.contains("characters").should("exist");

    // AC3: no consent → the server refuses and says why, under the checkbox.
    cy.contains("button", "Run check").click();
    cy.contains("Please confirm you agree to send this text to the AI provider.").should("be.visible");

    cy.contains("label", "Send this text to the AI provider").click();
    cy.contains("Please confirm you agree").should("not.exist");
    cy.contains("Some fields need attention.").should("not.exist");
    capture("PB-10-new-check", "section[aria-labelledby=new-check-heading]");
    cy.contains("button", "Run check").click();

    cy.location("pathname", { timeout: 30000 }).should("match", /\/coverage\/[^/]+$/);
    cy.contains("h2", title);
    cy.get("[aria-label^='Coverage score']").should("exist");
    cy.contains("Checked by built-in test model · keyword-mock-v1 · prompt v1");

    // AC1: Missing first, with text (not only color) and a suggestion.
    cy.get("tbody tr")
      .first()
      .within(() => {
        cy.contains("Missing");
        cy.contains("Cite at least three peer-reviewed sources in APA format");
        cy.contains("No matching text in the draft.");
        cy.contains("Add a section that covers");
      });
    cy.contains("tr", "drawbacks of social media").should("contain", "Partial");
    cy.contains("tr", "Conclude with a recommendation").within(() => {
      cy.contains("Covered");
      cy.contains("Found in your draft");
    });
    capture("PB-10-report");
    cy.checkPageA11y();

    cy.contains("a", /^Missing \(1\)$/).click();
    cy.location("search").should("eq", "?status=MISSING");
    cy.get("tbody tr").should("have.length", 1);

    cy.contains("summary", "Draft").click();
    cy.contains("A 2021 study found benefits").should("be.visible");

    cy.contains("a", "Back to AI Coverage Check").click();
    cy.contains("tr", title).should("contain", "Presentation").and("contain", "1 missing");
  });

  it("AC7: the author permanently deletes a report", () => {
    const title = `E2E delete ${Date.now()}`;
    cy.visitTeam("coverage");
    fillForm(title);
    cy.contains("label", "Send this text to the AI provider").click();
    cy.contains("button", "Run check").click();
    cy.location("pathname", { timeout: 30000 }).should("match", /\/coverage\/[^/]+$/);

    cy.contains("button", "Delete report").click();
    cy.get("dialog[open]").within(() => {
      cy.contains("Permanently delete this report?");
      cy.contains("button", "Delete permanently").click();
    });
    cy.location("pathname").should("match", /\/coverage$/);
    cy.contains("Report deleted");
    cy.contains("tr", title).should("not.exist");
    cy.get("[data-sonner-toast]", { timeout: 10000 }).should("not.exist");
    cy.checkPageA11y();
  });

  it("AC5: an AI failure is shown inline with the server's message", () => {
    cy.intercept("POST", "/api/v1/teams/*/coverage-reports", {
      statusCode: 502,
      body: {
        error: {
          code: "UPSTREAM",
          message: "The AI service didn't respond in time. Nothing was lost — try again in a minute.",
        },
      },
    });
    cy.visitTeam("coverage");
    fillForm(`E2E failure ${Date.now()}`);
    cy.contains("label", "Send this text to the AI provider").click();
    cy.contains("button", "Run check").click();
    cy.get("[role=alert]").should(
      "contain",
      "The AI service didn't respond in time. Nothing was lost — try again in a minute.",
    );
    cy.get("input[name=title]").should("not.have.value", ""); // input kept for a retry
    cy.checkPageA11y();
  });
});

/**
 * Screenshot of a REAL provider failure (not stubbed). Only registered with `--expose CAPTURE=1,CAPTURE_FAILURE=1`
 * against a server started with AI_PROVIDER=openai and no OPENAI_API_KEY; the adapter refuses before sending anything.
 */
if (Cypress.expose("CAPTURE_FAILURE")) {
  describe("PB-10 failure screenshot (manual)", () => {
    beforeEach(() => cy.login("devarsh"));

    it("AC5: shows the failure inline and records a FAILED report", () => {
      const title = `Failure demo ${Date.now()}`;
      cy.visitTeam("coverage");
      fillForm(title);
      cy.contains("label", "Send this text to the AI provider (OpenAI)").click();
      capture("PB-10-new-check", "section[aria-labelledby=new-check-heading]");
      cy.contains("button", "Run check").click();
      cy.get("[role=alert]").should("contain", "Nothing was lost — try again in a minute.");
      cy.contains("tr", title).should("contain", "Didn't finish");
      capture("PB-10-failure");
      cy.contains("a", title).click();
      cy.contains("This check didn't finish.");
      cy.contains("The AI provider isn't configured (missing API key)");
      capture("PB-10-failure-report");
    });
  });
}
