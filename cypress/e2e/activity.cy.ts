/** PB-09 · FR-06 — activity history on the seeded "StudyCrew Core" team. */
describe("PB-09 activity history", () => {
  beforeEach(() => cy.login("varad"));

  it("AC1/AC6: shows who did what, newest first, grouped by day, with no a11y violations", () => {
    cy.visitTeam("activity");
    cy.contains("h2", "Activity");
    cy.contains("li", "Varad Tambe").should("contain", "created the team");
    cy.contains("li", "Dev Patel").should("contain", "completed “Set up CI pipeline”");
    cy.get("time[datetime]").should("have.length.at.least", 3);
    cy.checkPageA11y();
  });

  it("AC2: filters by member and category, and the filter survives a reload", () => {
    cy.visitTeam("activity");
    cy.get("#activity-actor").select("Krish Ruparel");
    cy.location("search").should("contain", "actor=");
    cy.contains("li", "joined the team").should("exist");
    cy.contains("li", "created the team").should("not.exist");
    cy.reload();
    cy.get("#activity-actor option:selected").should("have.text", "Krish Ruparel");
    cy.contains("button", "Clear filters").click();
    cy.get("#activity-entity").select("Tasks");
    cy.contains("li", "completed “Set up CI pipeline”").should("exist");
    cy.contains("li", "created the team").should("not.exist");
    cy.get("#activity-entity").select("Polls");
    cy.contains("No matching activity").should("be.visible");
  });

  it("AC4: non-members can't see the history", () => {
    cy.visitTeam("activity");
    cy.location("pathname").then((path) => {
      cy.login("outsider");
      cy.visit(path);
      cy.contains("not a member").should("be.visible");
      cy.contains("created the team").should("not.exist");
    });
  });
});
