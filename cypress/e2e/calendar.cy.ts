/** PB-06 · FR-03 — calendar, meeting finder, scheduling, RSVP (seeded "StudyCrew Core" has weekday-evening availability). */
describe("PB-06 calendar and meeting finder", () => {
  it("AC1/AC5/AC8: find a time → schedule → RSVP, with no a11y violations", () => {
    const title = `E2E sync ${Date.now()}`;
    cy.login("varad");
    cy.visitTeam("calendar");
    cy.contains("h2", "Calendar");
    cy.contains("h3", /Best times (this|that) week/);
    cy.contains("Times are in your time zone (America/Chicago)");
    cy.checkPageA11y();

    cy.contains("button", "Find a time").click();
    cy.get("dialog[open]").within(() => {
      cy.contains("button", "Search").click();
      cy.get("ol li").should("have.length.at.least", 1);
      cy.get("ol li").first().should("contain", "free");
      cy.get("ol li").first().contains("button", "Schedule").click();
    });

    cy.get("dialog[open]").within(() => {
      cy.contains("h2", "Schedule a meeting");
      cy.get("input[name=start]")
        .invoke("val")
        .should("match", /^\d{2}:\d{2}$/);
      cy.get("input[name=title]").type(title);
      cy.get("input[name=location]").type("ERB 129");
      cy.contains("button", /^Schedule$/).click();
    });

    cy.location("pathname").should("match", /\/calendar\/[^/]+$/);
    cy.contains("h2", title);
    cy.contains("ERB 129");
    cy.contains("button", "Going").should("have.attr", "aria-pressed", "true"); // organizer is going by default
    cy.contains("button", "Maybe").click();
    cy.contains("Answer saved");
    cy.contains("button", "Maybe").should("have.attr", "aria-pressed", "true");
    cy.checkPageA11y();

    cy.contains("a", "Back to calendar").click();
    cy.contains("a", title).should("exist");
  });

  it("AC6: members can't edit or cancel someone else's meeting", () => {
    cy.login("krish");
    cy.visitTeam("calendar");
    cy.location("pathname").then((calendarPath) => {
      const teamId = calendarPath.split("/")[2];
      const from = new Date(Date.now() - 86_400_000).toISOString();
      const to = new Date(Date.now() + 14 * 86_400_000).toISOString();
      cy.request(`/api/v1/teams/${teamId}/meetings?from=${from}&to=${to}`).then((res) => {
        const seeded = res.body.data.find((m: { title: string }) => m.title === "Sprint review and retro");
        expect(seeded, "seeded meeting").not.to.equal(undefined);
        cy.visit(`${calendarPath}/${seeded.id}`);
        cy.contains("h2", "Sprint review and retro");
        cy.contains("button", "Edit").should("not.exist");
        cy.contains("button", "Cancel meeting").should("not.exist");
        cy.contains("Are you coming?");
      });
    });
  });

  it("week navigation moves by a week", () => {
    cy.login("varad");
    cy.visitTeam("calendar");
    cy.get("[aria-label='Next week']").click();
    cy.location("search").should("match", /week=\d{4}-\d{2}-\d{2}/);
    cy.contains("a", "This week").click();
    cy.location("search").should("eq", "");
  });
});
