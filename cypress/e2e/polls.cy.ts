/**
 * PB-14 polls: create (with validation), vote, change vote, second member votes, leader closes early → final choice.
 * Uses its own uniquely named poll, and reads expected numbers back from the API, so other specs sharing the seeded DB
 * can't change the outcome. Nothing depends on today's date or weekday (the default close time is "in 2 days").
 */
const toastGone = (text: string) => cy.contains("[data-sonner-toast]", text, { timeout: 10000 }).should("not.exist");

type PollApi = { id: string; question: string; isClosed: boolean; totalVotes: number; winningOptionId: string | null; options: Array<{ id: string; label: string; votes: number }> };

function pollFromApi(teamId: string, question: string) {
  return cy.request(`/api/v1/teams/${teamId}/polls`).then(({ body }) => (body.data as PollApi[]).find((p) => p.question === question)!);
}

function card(question: string) {
  return cy.contains("h3", question).closest("section[aria-labelledby]");
}

describe("PB-14 group polls", () => {
  it("AC1–AC4: create, vote, change vote, close early; the tie goes to the option listed first", () => {
    const question = `Where do we meet? ${Date.now()}`;
    let teamId = "";

    cy.login("varad");
    cy.visitTeam("polls");
    cy.location("pathname").then((p) => (teamId = p.split("/")[2]));
    cy.contains("h2", "Polls");
    cy.checkPageA11y();

    // AC1: the API's field errors show in the dialog.
    cy.contains("button", "New poll").click();
    cy.get("dialog[open]").within(() => {
      cy.contains("button", "Start poll").click();
      cy.contains("Ask a question.").should("be.visible");
      cy.contains(/Add at least 2 options/).should("be.visible");
    });
    cy.get("dialog[open]").within(() => {
      cy.get("input[name=question]").type(question);
      cy.get("input[aria-label='Option 1']").type("Library");
      cy.get("input[aria-label='Option 2']").type("Zoom");
      cy.contains("button", "Add option").click();
      cy.get("input[aria-label='Option 3']").type("Cafe");
    });
    cy.checkPageA11y(); // the dialog, with field errors showing
    cy.get("dialog[open]").contains("button", "Start poll").click();
    cy.contains("Poll started").should("be.visible");
    card(question).should("contain", "Open").and("contain", "Vote to see the results.");

    // AC2: vote, then change the vote: still one vote.
    card(question).contains("label", "Library").click();
    cy.contains("Vote saved").should("be.visible");
    card(question).contains("label", "Zoom").click();
    cy.contains("Vote changed").should("be.visible");
    card(question).should("contain", "1 vote so far");
    cy.then(() =>
      pollFromApi(teamId, question).then((p) => {
        expect(p.totalVotes).to.eq(1);
        expect(p.options.find((o) => o.label === "Zoom")!.votes).to.eq(1);
      }),
    );

    // A second member votes for Library → 1–1 tie.
    cy.login("krish");
    cy.visit("/dashboard");
    cy.then(() => cy.visit(`/teams/${teamId}/polls`));
    card(question).contains("label", "Library").click();
    cy.contains("Vote saved").should("be.visible");
    card(question).should("contain", "2 votes so far");
    toastGone("Vote saved");
    cy.checkPageA11y();

    // AC3: the leader closes early. AC4: the tie goes to Library (listed first).
    cy.login("varad");
    cy.then(() => cy.visit(`/teams/${teamId}/polls`));
    card(question).contains("button", "Close poll now").click();
    cy.get("dialog[open]").contains("button", "Close poll").click();
    cy.contains("Poll closed").should("be.visible");
    cy.contains("section[aria-labelledby='closed-polls']", question).within(() => {
      cy.contains("Final choice: Library");
      cy.contains("Zoom").parent().should("contain", "1 vote (50%)");
    });
    cy.then(() =>
      pollFromApi(teamId, question).then((p) => {
        expect(p.isClosed).to.eq(true);
        expect(p.winningOptionId).to.eq(p.options.find((o) => o.label === "Library")!.id);
      }),
    );
    toastGone("Poll closed");
    cy.checkPageA11y();

    // AC2: voting after close → 409; AC3: the result is in activity history.
    cy.then(() =>
      pollFromApi(teamId, question).then((p) => {
        cy.request({
          method: "PUT",
          url: `/api/v1/teams/${teamId}/polls/${p.id}/vote`,
          body: { optionId: p.options[0].id },
          failOnStatusCode: false,
        }).then((res) => {
          expect(res.status).to.eq(409);
          expect(res.body.error.message).to.eq("This poll has closed.");
        });
      }),
    );
    cy.then(() => cy.visit(`/teams/${teamId}/activity`));
    cy.contains(`closed the poll “${question}” — winner: “Library” (1 vote)`).should("be.visible");
  });
});
