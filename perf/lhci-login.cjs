/**
 * PB-17 · NFR-03 — Lighthouse CI puppeteer script (lighthouserc.json → collect.puppeteerScript).
 * Signs in once per Chrome instance so signed-in pages are audited, not the sign-in redirect.
 * `disableStorageReset: true` in lighthouserc.json keeps the session cookie between audits.
 *
 * Account: LHCI_EMAIL / LHCI_PASSWORD, defaulting to the public seed demo account (prisma/seed.ts; staging only ever
 * holds test data, see docs/process/deployment.md).
 */
let signedIn = false;

module.exports = async (browser, context) => {
  if (signedIn) return;
  const origin = new URL(context.url).origin;
  const page = await browser.newPage();
  await page.goto(`${origin}/sign-in`, { waitUntil: "networkidle0" });
  const status = await page.evaluate(
    async (email, password) => {
      const res = await fetch("/api/auth/sign-in/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "same-origin",
      });
      return res.status;
    },
    process.env.LHCI_EMAIL || "varad@studycrew.test",
    process.env.LHCI_PASSWORD || "studycrew-dev-pass",
  );
  if (status !== 200) throw new Error(`Lighthouse sign-in failed with HTTP ${status}`);
  signedIn = true;
  await page.close();
};
