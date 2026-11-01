"use client";

import { Cell, Pie, PieChart } from "recharts";
import { useHydrated } from "./use-hydrated";

// Theme tokens (globals.css): success-600 fill on a success-100 track, so the unfilled part reads as "not done yet".
const DONE = "#059669";
const TRACK = "#d1fae5";
const SIZE = 112;

/**
 * AC4: completion donut with the % as text in the centre. The ring is decoration (aria-hidden); the number and the
 * "N of M tasks done" line next to it carry the information.
 */
export function CompletionDonut({ percent, done, total }: { percent: number; done: number; total: number }) {
  const hydrated = useHydrated();
  const data = [
    { name: "Done", value: done, fill: DONE },
    { name: "Not done", value: Math.max(total - done, 0), fill: TRACK },
  ];
  return (
    <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
      <div aria-hidden className="absolute inset-0">
        {hydrated && total > 0 ? (
          // Recharts makes the svg and the pie focusable by default; inside aria-hidden nothing may be focusable.
          <PieChart width={SIZE} height={SIZE} accessibilityLayer={false}>
            <Pie
              data={data}
              dataKey="value"
              innerRadius={40}
              outerRadius={54}
              startAngle={90}
              endAngle={-270}
              stroke="#ffffff"
              strokeWidth={2}
              isAnimationActive={false}
              rootTabIndex={-1}
            >
              {data.map((d) => (
                <Cell key={d.name} fill={d.fill} />
              ))}
            </Pie>
          </PieChart>
        ) : (
          // Server render, and teams with no tasks: the empty track.
          <div className="absolute inset-[2px] rounded-full border-[14px]" style={{ borderColor: TRACK }} />
        )}
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-2xl font-semibold text-slate-900">{percent}%</span>
      </div>
    </div>
  );
}
