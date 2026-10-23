/// <reference types="cypress" />
/**
 * Shared E2E commands. Seed accounts are listed in prisma/seed.ts (CI runs the seed first).
 *   cy.login("krish")          // signs in via the API; fast and not flaky
 *   cy.visitTeam("board")      // opens the seeded "StudyCrew Core" team at a tab
 *   cy.checkPageA11y()         // fails on serious/critical axe violations (NFR-03)
 */
export const SEED_PASSWORD = "studycrew-dev-pass";
export type SeedUser = "varad" | "krish" | "dev" | "devarsh" | "outsider" | "maya";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      login(user?: SeedUser): Chainable<void>;
      visitTeam(tab?: string): Chainable<void>;
      checkPageA11y(): Chainable<void>;
    }
  }
}

/**
 * Better Auth rate-limits sign-in in production builds (a few attempts per 10 s), and a full E2E run
 * signs in many times. Instead of weakening the limit, wait for `x-retry-after` and try again.
 */
function signInWithRetry(user: SeedUser, attempt = 1): Cypress.Chainable<unknown> {
  return cy
    .request({
      method: "POST",
      url: "/api/auth/sign-in/email",
      body: { email: `${user}@studycrew.test`, password: SEED_PASSWORD },
      headers: { origin: Cypress.config("baseUrl")! },
      failOnStatusCode: false,
    })
    .then((res) => {
      if (res.status === 429 && attempt < 8) {
        const seconds = Number(res.headers["x-retry-after"]) || 2;
        cy.wait(seconds * 1000 + 250, { log: false });
        return signInWithRetry(user, attempt + 1);
      }
      expect(res.status, `sign-in as ${user}`).to.eq(200);
    });
}

Cypress.Commands.add("login", (user: SeedUser = "varad") => {
  cy.session(user, () => {
    signInWithRetry(user);
  });
});

Cypress.Commands.add("visitTeam", (tab = "") => {
  cy.visit("/dashboard");
  cy.contains("a", "StudyCrew Core").first().click();
  cy.location("pathname").should("match", /^\/teams\/[^/]+$/);
  if (tab) {
    cy.location("pathname").then((p) => cy.visit(`${p}/${tab}`));
  }
});

Cypress.Commands.add("checkPageA11y", () => {
  cy.injectAxe();
  cy.checkA11y(undefined, { includedImpacts: ["serious", "critical"] });
});

export {};
