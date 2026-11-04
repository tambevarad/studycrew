/**
 * PB-17 · NFR-03 — axe sweep over 19 pages: 0 serious/critical violations each (cy.checkPageA11y()).
 * 3 public pages, 7 signed-in pages, and 9 team tabs of the seeded "StudyCrew Core". Every page is visited fresh and
 * waits for its main heading, so loading skeletons are never what gets checked.
 */
const PUBLIC_PAGES: Array<[string, string]> = [
  ["/", "Plan together"],
  ["/sign-in", "Sign in"],
  ["/sign-up", "Create your account"],
];

const APP_PAGES: Array<[string, string]> = [
  ["/dashboard", ""],
  ["/teams", "Find teams"],
  ["/teams/new", "Create a team"],
  ["/profile", "Your profile"],
  ["/availability", "My availability"],
  ["/notifications", "Notifications"],
  ["/join/core-cse6324-demo", ""], // seeded invite code; signed in as a member it shows "already a member"
];

const TEAM_TABS = ["", "board", "calendar", "resources", "coverage", "milestones", "polls", "activity", "members"];

describe("PB-17 NFR-03 axe sweep (19 pages)", () => {
  it("counts 19 pages", () => {
    expect(PUBLIC_PAGES.length + APP_PAGES.length + TEAM_TABS.length).to.eq(19);
  });

  PUBLIC_PAGES.forEach(([path, heading]) => {
    it(`public ${path}`, () => {
      cy.clearAllCookies();
      cy.visit(path);
      cy.contains("h1", heading);
      cy.checkPageA11y();
    });
  });

  APP_PAGES.forEach(([path, heading]) => {
    it(`signed in ${path}`, () => {
      cy.login("varad");
      cy.visit(path);
      cy.get("main h1").should("be.visible");
      if (heading) cy.contains("h1", heading);
      cy.get("[role=status][aria-busy=true]").should("not.exist");
      cy.checkPageA11y();
    });
  });

  TEAM_TABS.forEach((tab) => {
    it(`team tab ${tab || "overview"}`, () => {
      cy.login("varad");
      cy.visitTeam(tab);
      cy.contains("h1", "StudyCrew Core");
      cy.get("[role=status][aria-busy=true]").should("not.exist");
      cy.checkPageA11y();
    });
  });
});
