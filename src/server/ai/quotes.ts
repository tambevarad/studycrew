/**
 * Evidence-quote verification (FR-07, AC2). The model is told to quote the draft word for word; this is
 * how the server checks it did, so an invented quote can never be shown as "Found in your draft".
 *
 * Normalization only removes differences that don't change the words: whitespace and line breaks,
 * curly vs straight quotes, dash and ellipsis variants, letter case. Anything else (a changed word,
 * a dropped word, "..." in the middle) makes the quote unverified.
 */
export const MIN_QUOTE_WORDS = 3;

export function normalizeForMatch(s: string): string {
  return s
    .normalize("NFKC")
    .replace(/[‘’‚‛′`´]/g, "'")
    .replace(/[“”„‟″«»]/g, '"')
    .replace(/[‐-―−]/g, "-")
    .replace(/…/g, "...")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** True when the quote has at least 3 words and appears in the draft after normalization. */
export function verifyQuote(quote: string | null | undefined, draft: string): boolean {
  if (!quote) return false;
  const q = normalizeForMatch(quote);
  if (q.split(" ").filter((w) => /[\p{L}\p{N}]/u.test(w)).length < MIN_QUOTE_WORDS) return false;
  return normalizeForMatch(draft).includes(q);
}

/**
 * Caps a quote at `max` characters without cutting a word in half. A prefix of a verbatim quote is still
 * verbatim, so this never turns a verified quote into an unverified one.
 */
export function clampQuote(quote: string, max: number): string {
  const trimmed = quote.trim();
  if (trimmed.length <= max) return trimmed;
  const cut = trimmed.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max / 2 ? cut.slice(0, lastSpace) : cut).trimEnd();
}
