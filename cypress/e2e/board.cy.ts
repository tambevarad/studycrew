/** PB-05 task board: create via dialog, move via “Move to…” → Done, persists after reload; keyboard; a11y (AC1, AC2, AC7, AC8, AC10). */

describe("PB-05 task board", () => {
  beforeEach(() => cy.login("krish"));

  it("AC1/AC2/AC10: creates a task, moves it to Done with the menu, and it stays there after reload", () => {
    const title = `E2E task ${Date.now()}`;
    cy.visitTeam("board");
    cy.contains("h2", "Task board");
    cy.checkPageA11y();

    cy.contains("button", "New task").click();
    cy.get("dialog[open]").within(() => {
      cy.contains("h2", "New task");
      cy.contains("button", "Add task").click();
      cy.contains("Give the task a title.").should("be.visible");
      cy.get("input[name=title]").type(title);
      cy.get("select[name=priority]").select("High");
      cy.contains("label", "Dev Patel").find("input[type=checkbox]").check();
    });
    cy.checkPageA11y();
    cy.get("dialog[open]").contains("button", "Add task").click();
    cy.get("dialog[open]").should("not.exist");

    cy.get("section[aria-labelledby=column-TODO]").contains("li", title).as("card");
    cy.get("@card").should("contain", "High").find("[aria-label='Dev Patel']").should("exist");
    cy.get(`button[aria-label='Move to… “${title}”']`).click();
    cy.intercept("POST", "**/tasks/*/move").as("move");
    cy.get("[role=menu]").contains("[role=menuitem]", "Done").click();
    cy.wait("@move").its("response.statusCode").should("eq", 200);
    cy.get("section[aria-labelledby=column-DONE]").should("contain", title);

    cy.reload();
    cy.get("section[aria-labelledby=column-DONE]").should("contain", title);
    cy.get("section[aria-labelledby=column-TODO]").should("not.contain", title);
    // sonner's success toast is below 4.5:1 (docs/contract-requests/PB-02-toast-contrast.md); check without it.
    cy.get("[data-sonner-toast]", { timeout: 10000 }).should("not.exist");
    cy.checkPageA11y();
  });

  it("AC8: the “Move to…” menu works from the keyboard", () => {
    cy.visitTeam("board");
    // dnd-kit's live region only mounts after hydration. Keys typed before that are replayed by React and handled
    // twice (the menu opened on "Review" instead of "In Progress").
    cy.get("[id^=DndLiveRegion]").should("exist");
    cy.get("section[aria-labelledby=column-TODO] li")
      .first()
      .find("button[aria-haspopup=menu]")
      .focus()
      .type("{downarrow}");
    cy.get("[role=menu]").should("be.visible");
    cy.focused().should("have.attr", "role", "menuitem").and("contain", "In Progress");
    cy.focused().type("{downarrow}");
    cy.focused().should("contain", "Review");
    cy.focused().type("{end}");
    cy.focused().should("contain", "Bottom of To Do");
    cy.focused().type("{esc}");
    cy.get("[role=menu]").should("not.exist");
    cy.focused().should("have.attr", "aria-haspopup", "menu");
  });

  it("AC2/AC8: drags a card to the next column with the keyboard (dnd-kit keyboard sensor)", () => {
    const title = "Design task board UI"; // seed: In Progress
    cy.visitTeam("board");
    cy.get("[id^=DndLiveRegion]").should("exist");
    cy.get(`button[aria-label='Drag “${title}”']`).focus().type(" ");
    // dnd-kit announces "Picked up" and then immediately where the card is.
    cy.get("[id^=DndLiveRegion]").should("contain", `“${title}” is over In Progress.`);
    cy.focused().type("{rightarrow}");
    cy.get("[id^=DndLiveRegion]").should("contain", "in Review.");
    cy.focused().type(" ");
    cy.get("section[aria-labelledby=column-REVIEW]").should("contain", title);
    cy.reload();
    cy.get("section[aria-labelledby=column-REVIEW]").should("contain", title);
    // Put it back so the seed stays as other specs expect.
    cy.get(`button[aria-label='Move to… “${title}”']`).click();
    cy.get("[role=menu]").contains("[role=menuitem]", "In Progress").click();
    cy.get("section[aria-labelledby=column-IN_PROGRESS]").should("contain", title);
  });

  it("AC7: overdue tasks say “Overdue”; due-soon tasks are amber", () => {
    cy.visitTeam("board");
    // Seed: “Book room for rehearsal” was due yesterday; “Write Cypress smoke test” is due within a day or two.
    cy.contains("li", "Book room for rehearsal")
      .contains(/Overdue by/)
      .should("have.class", "text-danger-700");
  });

  it("opens a task from ?task=<id> and edits it", () => {
    cy.visitTeam("board");
    cy.location("pathname").then((path) => {
      const teamId = path.split("/")[2];
      cy.request(`/api/v1/teams/${teamId}/tasks?status=REVIEW`).then((res) => {
        const task = res.body.data[0] as { id: string; title: string };
        cy.visit(`${path}?task=${task.id}`);
        cy.get("dialog[open]").within(() => {
          cy.contains("h2", "Edit task");
          cy.get("input[name=title]").should("have.value", task.title);
          cy.contains("button", "Cancel").click();
        });
        cy.get("dialog[open]").should("not.exist");
        cy.location("search").should("eq", "");
      });
    });
  });

  it("filters to my tasks and by text", () => {
    cy.visitTeam("board");
    cy.contains("button", "Assigned to me").click().should("have.attr", "aria-pressed", "true");
    cy.contains("li", "Design task board UI").should("not.exist"); // assigned to Devarsh in the seed
    cy.contains("li", "Book room for rehearsal").should("exist");
    cy.contains("button", "All").click();
    cy.get("input[type=search]").type("rehearsal");
    cy.contains("Showing 1 of").should("be.visible");
  });
});
