// PB-17 · NFR-02 — make sure no secret ended up in the JavaScript sent to browsers. Pass: 0 FAIL matches.
//   npm run build && node security/scan-client-bundle.mjs [dir]   (default dir: .next/static)
// Prints the file and the KIND of match only, never the matched text, so the report itself can't leak a secret.
//
// Two checks:
// 1. Key-shaped strings (OpenAI/Anthropic/Google/GitHub/AWS keys, private keys, connection strings with a password) → FAIL.
// 2. If server-only env vars are SET while scanning (CI exports them for the build), their VALUES must not appear → FAIL.
// Server-only env NAMES are listed as warnings only: libraries legitimately mention them (e.g. Better Auth's client SDK
// contains a `BETTER_AUTH_SECRET` getter that reads undefined in the browser). A name isn't a secret; a value is.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const root = process.argv[2] ?? ".next/static";
const SECRET_SHAPES = [
  ["Postgres connection string with password", /postgres(?:ql)?:\/\/[^\s"'`/:@]+:[^\s"'`@]+@/],
  ["OpenAI key", /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}/],
  ["Anthropic key", /\bsk-ant-[A-Za-z0-9_-]{20,}/],
  ["Google API key", /\bAIza[0-9A-Za-z_-]{35}\b/],
  ["GitHub token", /\bgh[pousr]_[A-Za-z0-9]{36,}\b/],
  ["AWS access key", /\bAKIA[0-9A-Z]{16}\b/],
  ["Private key block", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
];
const SERVER_ONLY = [
  "DATABASE_URL",
  "DATABASE_URL_UNPOOLED",
  "TEST_DATABASE_URL",
  "BETTER_AUTH_SECRET",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "VERCEL_TOKEN",
  "VERCEL_OIDC_TOKEN",
];
// Only values long enough to be meaningful are checked (avoids matching e.g. "mock" or "true").
const setValues = SERVER_ONLY.map((name) => [name, process.env[name]]).filter(([, v]) => v && v.length >= 12);

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) yield* files(p);
    else if (/\.(js|mjs|cjs|json|map|html|txt)$/.test(name)) yield p;
  }
}

let scanned = 0;
const fails = [];
const warns = [];
try {
  for (const file of files(root)) {
    scanned++;
    const rel = path.relative(".", file);
    const text = readFileSync(file, "utf8");
    for (const [kind, re] of SECRET_SHAPES) if (re.test(text)) fails.push(`${rel}: ${kind}`);
    for (const [name, value] of setValues) if (text.includes(value)) fails.push(`${rel}: the VALUE of ${name}`);
    for (const name of SERVER_ONLY) if (new RegExp(`\\b${name}\\b`).test(text)) warns.push(`${rel}: mentions the name ${name}`);
  }
} catch (err) {
  console.error(`Can't read ${root}. Run \`npm run build\` first. (${err.message})`);
  process.exit(2);
}
console.log(`Scanned ${scanned} client files under ${root}; checked the values of ${setValues.length} server-only env vars that are set.`);
for (const w of warns) console.log(`  warn ${w} (name only, not a value)`);
for (const f of fails) console.log(`  FAIL ${f}`);
console.log(fails.length === 0 ? "PASS: no key-shaped strings or server-only env values in the client bundle." : `FAIL: ${fails.length} match(es).`);
process.exit(fails.length === 0 ? 0 : 1);
