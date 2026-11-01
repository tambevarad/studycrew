/** Pure text rules for tasks made from AI suggestions (unit-tested). */

const TITLE_MAX = 200; // createTaskInput.title max
const DESCRIPTION_MAX = 5000; // createTaskInput.description max

function clip(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** The suggestion if the AI gave one, else the requirement itself. */
export function taskTitleFor(item: { suggestion: string | null; requirement: string }): string {
  return clip(item.suggestion?.trim() || item.requirement, TITLE_MAX);
}

/** “From AI Coverage Check “Title”: requirement — reason” (PB-11 spec). */
export function taskDescriptionFor(item: { requirement: string; reason: string }, reportTitle: string): string {
  return clip(`From AI Coverage Check “${reportTitle}”: ${item.requirement} — ${item.reason}`, DESCRIPTION_MAX);
}
