/** PB-03 availability grid: paint with the mouse, erase, keyboard selection, save + reload, time zone, a11y (AC1–AC3, AC7, AC8). */
const slot = (day: number, halfHour: number) => day * 48 + halfHour;
const cell = (s: number) => cy.get(`[role=gridcell][data-slot=${s}]`);
/**
 * Mouse-paint from one cell to another (press → drag → release) with real PointerEvents at each cell's centre.
 * Cypress's `trigger()` events didn't carry the pointer data the grid reads on move, so we dispatch them ourselves.
 */
function fire(s: number, type: "pointerdown" | "pointermove" | "pointerup", pointerId: number) {
  cell(s).then(($el) => {
    const el = $el[0];
    const win = el.ownerDocument.defaultView as Window & typeof globalThis;
    el.scrollIntoView({ block: "center" }); // elementFromPoint only sees what's in the viewport
    const r = el.getBoundingClientRect();
    const init = {
      bubbles: true,
      pointerId,
      button: 0,
      buttons: type === "pointerup" ? 0 : 1,
      clientX: r.left + r.width / 2,
      clientY: r.top + r.height / 2,
    };
    el.dispatchEvent(new win.PointerEvent(type, init));
  });
}
function paint(from: number, to: number, pointerId: number) {
  fire(from, "pointerdown", pointerId);
  if (to !== from) fire(to, "pointermove", pointerId);
  fire(to, "pointerup", pointerId);
}

describe("PB-03 availability grid", () => {
  let original: number[] = [];

  beforeEach(() => {
    cy.login("krish");
    cy.request("/api/v1/me/availability").then((res) => (original = res.body.data.slots));
  });

  // Put Krish's seeded availability back so other specs (meeting finder) see the seed.
  afterEach(() => {
    cy.request({ method: "PUT", url: "/api/v1/me/availability", body: { slots: original } });
  });

  // Let Better Auth's sign-in rate limit (3 per 10 s) reset before the next spec
  // (docs/contract-requests/PB-05-e2e-sign-in-rate-limit.md).
  after(() => cy.wait(10_000));

  function visitHydrated() {
    cy.visit("/availability");
    // Toggling "Show all hours" only works once React has hydrated; keys/pointer events before that get replayed.
    cy.contains("label", "Show all hours").find("input").check();
    cy.get(`[data-slot=${slot(0, 0)}]`).should("exist");
    cy.contains("label", "Show all hours").find("input").uncheck();
    cy.get(`[data-slot=${slot(0, 0)}]`).should("not.exist");
  }

  it("AC1/AC2/AC7/AC8: paints Mon 18:00 → Wed 21:30 with the mouse, erases from a filled cell, saves, and reloads", () => {
    visitHydrated();
    cy.contains("Times are in your time zone: America/Chicago");
    cy.contains("a", "Change in Profile").should("have.attr", "href", "/profile");
    cy.checkPageA11y();

    cy.contains("button", "Clear all").click();
    cy.get("dialog[open]").contains("button", "Clear all").click();
    cy.contains("You haven't marked any free time yet.");

    paint(slot(0, 36), slot(2, 43), 1);
    cell(slot(1, 40)).should("have.attr", "aria-selected", "true");
    cy.get("ul[aria-label='Your free times']")
      .should("contain", "Mon 6:00 PM–10:00 PM")
      .and("contain", "Tue 6:00 PM–10:00 PM")
      .and("contain", "Wed 6:00 PM–10:00 PM");

    // AC2: starting on a filled cell erases.
    paint(slot(0, 36), slot(0, 38), 2);
    cell(slot(0, 37)).should("have.attr", "aria-selected", "false");
    cy.get("ul[aria-label='Your free times']").should("contain", "Mon 7:30 PM–10:00 PM");

    cy.contains("unsaved change").should("be.visible");
    cy.contains("button", "Save availability").click();
    cy.contains("Availability saved").should("be.visible");
    cy.contains("unsaved change").should("not.exist");

    cy.reload();
    cy.get("ul[aria-label='Your free times']")
      .should("contain", "Mon 7:30 PM–10:00 PM")
      .and("contain", "Wed 6:00 PM–10:00 PM");
    cy.request("/api/v1/me/availability")
      .its("body.data.slots")
      .should("have.length", 24 - 3);
    // sonner's success toast is below 4.5:1 (docs/contract-requests/PB-02-toast-contrast.md); check without it.
    cy.get("[data-sonner-toast]", { timeout: 10000 }).should("not.exist");
    cy.checkPageA11y();
  });

  it("AC3: selects and saves availability with only the keyboard", () => {
    visitHydrated();
    cy.get("[role=gridcell][tabindex=0]").focus().type("{end}"); // Sunday, same row (6:00 PM)
    cy.focused().should("have.attr", "data-slot", String(slot(6, 36)));
    cy.focused().type("{shift}{downarrow}{downarrow}");
    cy.focused().type("{enter}");
    cy.get("ul[aria-label='Your free times']").should("contain", "Sun 6:00 PM–7:30 PM");
    // Space toggles a single half-hour.
    cy.focused().type("{downarrow} ");
    cy.get("ul[aria-label='Your free times']").should("contain", "Sun 6:00 PM–8:00 PM");
    cy.focused().type(" ");
    cy.get("ul[aria-label='Your free times']").should("contain", "Sun 6:00 PM–7:30 PM");
    // Native buttons activate with Enter/Space in real browsers; Cypress can't simulate that, so click.
    cy.contains("button", "Save availability").click();
    cy.contains("unsaved change").should("not.exist");
    cy.request("/api/v1/me/availability")
      .its("body.data.slots")
      .should("include.members", [slot(6, 36), slot(6, 37), slot(6, 38)]);
  });

  it("quick actions: weekday evenings preset and copy Monday to weekdays", () => {
    visitHydrated();
    cy.contains("button", "Clear all").click();
    cy.get("dialog[open]").contains("button", "Clear all").click();
    cy.contains("button", "Weekday evenings (6–10 pm)").click();
    cy.get("ul[aria-label='Your free times'] li").should("have.length", 5);
    paint(slot(0, 44), slot(0, 44), 3);
    cy.contains("button", "Copy Monday to weekdays").click();
    cy.get("ul[aria-label='Your free times']").should("contain", "Fri 6:00 PM–10:30 PM");
    cy.contains("button", "Discard").click();
    cy.contains("unsaved change").should("not.exist");
  });
});
