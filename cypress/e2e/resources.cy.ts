/** PB-07 · FR-05 — notes, links, and file references on the seeded "StudyCrew Core" team. */
describe("PB-07 resources", () => {
  beforeEach(() => cy.login("krish"));

  it("AC1/AC2/AC5/AC6: add a link, pin it, find it, delete it — accessibly", () => {
    const title = `E2E link ${Date.now()}`;
    cy.visitTeam("resources");
    cy.contains("h2", "Resources");
    cy.contains("Course syllabus"); // seeded, pinned
    cy.checkPageA11y();

    cy.contains("button", "Add").click();
    cy.get("dialog[open]").within(() => {
      cy.get("input[name=title]").type(title);
      cy.get("input[name=url]").type("ftp://bad.example");
      cy.contains("button", "Add link").click();
    });
    cy.contains("Links must start with http:// or https://").should("be.visible");
    cy.get("dialog[open] input[name=url]").clear().type("https://docs.google.com/document/d/e2e");
    cy.get("dialog[open]").contains("button", "Add link").click();
    cy.contains("Link added");
    cy.contains("li", title).should("contain", "Google Drive");

    cy.get(`[aria-label="Pin “${title}”"]`).click();
    cy.contains("section", "Pinned").should("contain", title);

    cy.get("input[aria-label='Search resources']").type(title.slice(0, 12));
    cy.location("search").should("contain", "q=");
    cy.contains("li", title);
    cy.contains("Course syllabus").should("not.exist");

    cy.get(`[aria-label="Delete “${title}”"]`).click();
    cy.get("dialog[open]").contains("button", "Delete").click();
    cy.contains("li", title).should("not.exist");
  });

  it("AC5: notes expand inline and the type filter works", () => {
    cy.visitTeam("resources");
    cy.contains("a", "Notes").click();
    cy.location("search").should("contain", "type=NOTE");
    cy.contains("button", "Retro notes — Sprint 2").as("note").should("have.attr", "aria-expanded", "false");
    cy.get("@note").click().should("have.attr", "aria-expanded", "true");
    cy.contains("Start: pair on calendar").should("be.visible");
    cy.contains("Course syllabus").should("not.exist");
  });

  it("AC4: members can't edit or delete what someone else added", () => {
    cy.visitTeam("resources");
    // "Course syllabus" was added by Varad; Krish is a member, not a leader.
    cy.contains("li", "Course syllabus").within(() => {
      cy.get("[aria-label^='Pin'], [aria-label^='Unpin']").should("exist");
      cy.get("[aria-label^='Edit']").should("not.exist");
      cy.get("[aria-label^='Delete']").should("not.exist");
    });
  });
});
