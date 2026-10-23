/** PB-02 accounts and profiles: sign up → welcome → courses → save; wrong password; sign out; a11y (AC1–AC4, AC9). */
describe("PB-02 accounts and profiles", () => {
  // Better Auth limits sign-in to 3 attempts per 10 s per IP in production. This spec signs in several times, so let
  // the window pass before the next spec, or its first sign-in gets 429 ("Too many attempts").
  after(() => cy.wait(10_000));
  it("AC1/AC5/AC9: signs up, lands on the profile with a welcome, and saves courses", () => {
    const email = `e2e-${Date.now()}@studycrew.test`;
    cy.visit("/sign-up");
    cy.checkPageA11y();

    // Client-side checks appear under the fields.
    cy.contains("button", "Create account").click();
    cy.contains("Enter your name.").should("be.visible");

    cy.get("input[name=name]").type("E2E Student");
    cy.get("input[name=email]").type(email);
    cy.get("input[name=password]").type("short");
    cy.contains("3 more characters needed.").should("be.visible");
    cy.get("input[name=password]").type("-but-long-now");
    cy.get("button[aria-label='Show password']").click();
    cy.get("input[name=password]").should("have.attr", "type", "text");
    cy.contains("button", "Create account").click();

    cy.location("pathname", { timeout: 15000 }).should("eq", "/profile");
    cy.contains("Welcome! Add your courses so teammates can find you.").should("be.visible");
    cy.contains("h1", "Your profile");
    cy.contains("button", "Save profile").should("be.disabled");

    cy.get("input[placeholder='CSE 6324']").type("cse6324{enter}");
    cy.get("input[placeholder='CSE 6324']").type("CSE 6324{enter}");
    cy.contains("“CSE 6324” is already in your list.").should("be.visible");
    cy.get("input[placeholder='CSE 6324']").clear().type("cse5311{enter}");
    cy.get("ul[aria-label='Your courses'] li").should("have.length", 2);
    cy.get("input[placeholder='Testing']").type("Cypress{enter}");
    cy.contains("button", "Save profile").should("not.be.disabled").click();
    cy.contains("Profile saved").should("be.visible");
    // sonner's rich success toast is below 4.5:1 (docs/contract-requests/PB-02-toast-contrast.md); check without it.
    cy.contains("Profile saved", { timeout: 10000 }).should("not.exist");
    cy.checkPageA11y();

    cy.reload();
    cy.get("ul[aria-label='Your courses']").should("contain", "CSE 6324").and("contain", "CSE 5311");
    cy.get("ul[aria-label='Your skills']").should("contain", "Cypress");

    // Signed-in users are sent away from the auth pages.
    cy.visit("/sign-in");
    cy.location("pathname").should("eq", "/dashboard");
  });

  it("AC2: an existing email gets a clear message with a sign-in link", () => {
    cy.visit("/sign-up");
    cy.get("input[name=name]").type("Duplicate Krish");
    cy.get("input[name=email]").type("krish@studycrew.test");
    cy.get("input[name=password]").type("another-password");
    cy.contains("button", "Create account").click();
    cy.contains("An account with that email already exists.").should("be.visible");
    cy.contains("a", "Sign in instead?").should("have.attr", "href", "/sign-in");
  });

  it("AC3/AC4/AC9: wrong password stays on the page; right password reaches the dashboard; sign out locks pages", () => {
    cy.visit("/sign-in?next=/profile");
    cy.checkPageA11y();
    cy.get("input[name=email]").type("krish@studycrew.test");
    cy.get("input[name=password]").type("wrong-password{enter}");
    cy.contains("don't match").should("be.visible");
    cy.location("pathname").should("eq", "/sign-in");

    cy.get("input[name=password]").clear().type("studycrew-dev-pass{enter}");
    cy.location("pathname", { timeout: 15000 }).should("eq", "/profile");

    cy.visit("/dashboard");
    cy.get("button[aria-label='Sign out']").first().click();
    cy.location("pathname", { timeout: 15000 }).should("eq", "/sign-in");
    cy.visit("/profile");
    cy.location("pathname").should("eq", "/sign-in");
  });

  it("AC9: the profile form works keyboard-only", () => {
    cy.login("krish");
    cy.visit("/profile");
    const skill = `Keyboard ${Date.now()}`;
    cy.get("input[placeholder='Testing']").focus().type(`${skill}{enter}`);
    cy.focused().should("have.attr", "placeholder", "Testing");
    cy.get("ul[aria-label='Your skills']").should("contain", skill);
    cy.contains("button", "Save profile").should("not.be.disabled");
    // Each chip's × is a native, focusable button (Enter/Space activate it in real browsers).
    cy.get(`button[aria-label='Remove ${skill}']`).should("have.attr", "type", "button").focus();
    cy.focused().should("have.attr", "aria-label", `Remove ${skill}`);
    // Backspace in the empty input removes the last chip.
    cy.get("input[placeholder='Testing']").focus().type("{backspace}");
    cy.get("ul[aria-label='Your skills']").should("not.contain", skill);
    cy.contains("button", "Save profile").should("be.disabled");
  });
});
