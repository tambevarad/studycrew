import { cn } from "@/lib/utils";
import { scoreLabel, scoreTone } from "./format";

const RADIUS = 40;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const STROKE = { success: "text-success-600", warning: "text-warning-600", danger: "text-danger-600" } as const;
const TEXT = { success: "text-success-700", warning: "text-warning-700", danger: "text-danger-700" } as const;

/** Coverage score as a ring (graphic) plus the number and a word label (text equivalent, UI guidelines §4). */
export function ScoreRing({ score }: { score: number }) {
  const tone = scoreTone(score);
  return (
    <div className="flex items-center gap-3">
      <svg viewBox="0 0 100 100" className="size-20 -rotate-90" role="img" aria-label={`Coverage score ${score} out of 100: ${scoreLabel(score)}`}>
        <circle cx="50" cy="50" r={RADIUS} fill="none" strokeWidth="10" className="stroke-slate-200" />
        <circle
          cx="50"
          cy="50"
          r={RADIUS}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          stroke="currentColor"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - score / 100)}
          className={STROKE[tone]}
        />
      </svg>
      <div aria-hidden>
        <p className="text-3xl font-semibold text-slate-900">
          {score}
          <span className="text-base font-normal text-slate-500"> / 100</span>
        </p>
        <p className={cn("text-sm font-medium", TEXT[tone])}>{scoreLabel(score)}</p>
      </div>
    </div>
  );
}
