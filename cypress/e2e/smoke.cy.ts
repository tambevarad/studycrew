/** Foundation smoke test: the app boots, auth works, the shell and team frame render, and pages are accessible. */
describe("smoke", () => {
  it("shows the landing page to visitors", () => {
    cy.visit("/");
    cy.contains("h1", "Plan together").should("be.visible");
    cy.checkPageA11y();
  });

  it("rejects a wrong password with a helpful message", () => {
    cy.visit("/sign-in");
    cy.get("input[name=email]").type("varad@studycrew.test");
    cy.get("input[name=password]").type("wrong-password");
    cy.contains("button", "Sign in").click();
    cy.contains("don't match").should("be.visible");
  });

  it("signs in and opens a team", () => {
    cy.login("varad");
    cy.visit("/dashboard");
    cy.contains("h1", "Hi, Varad");
    cy.checkPageA11y();
    cy.visitTeam();
    cy.contains("h1", "StudyCrew Core");
    cy.get("nav[aria-label='Team sections']").should("contain", "Board");
    // The shared shell and team frame must stay accessible on team pages too (active team row, tabs).
    cy.checkPageA11y();
  });

  it("hides team content from non-members", () => {
    cy.login("varad");
    cy.visitTeam();
    cy.location("pathname").then((teamPath) => {
      cy.login("outsider");
      cy.visit(teamPath);
      cy.contains("not a member").should("be.visible");
      cy.get("nav[aria-label='Team sections']").should("not.exist");
    });
  });

  it("reports health", () => {
    cy.request("/api/health").its("body.status").should("eq", "ok");
  });
});
