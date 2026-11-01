"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Rectangle,
  type RectangleProps,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TeamDashboardDTO } from "@/contracts/dashboard";
import { useHydrated } from "./use-hydrated";

// Series colours (validated with the dataviz palette check: CVD ΔE 29.8, contrast ≥ 3:1 on white).
const OVERDUE = "#dc2626"; // danger-600: a problem state, labelled "Overdue" in the legend and table
const ON_TIME = "#4f46e5"; // brand-600
const ROW_PX = 36;

// Recharts drops zero-width bars (and their labels) unless the bar has a custom shape. Keeping them means the total
// still shows for a member with 0 open tasks, and for one whose open tasks are all overdue.
const keepEmptyBar = (props: RectangleProps) => <Rectangle {...props} />;

type Row = TeamDashboardDTO["openTasksPerMember"][number];

function WorkloadTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: ChartRow }> }) {
  const row = active ? payload?.[0]?.payload : undefined;
  if (!row) return null;
  return (
    <div className="bg-surface rounded-md border border-slate-200 px-3 py-2 text-xs shadow-md">
      <p className="font-medium text-slate-900">{row.name}</p>
      <p className="text-slate-700">{row.open} open</p>
      <p className="text-slate-700">{row.overdue} overdue</p>
    </div>
  );
}

type ChartRow = { name: string; open: number; overdue: number; onTime: number };

/**
 * AC3/AC4: open tasks per member as horizontal stacked bars (overdue at the baseline, the rest on time), the total
 * at each bar's end, a legend, and a visually hidden table with the same numbers for screen readers.
 */
export function WorkloadChart({ rows }: { rows: Row[] }) {
  const hydrated = useHydrated();
  const data: ChartRow[] = rows.map((r) => ({
    name: r.user.name,
    open: r.open,
    overdue: r.overdue,
    onTime: r.open - r.overdue,
  }));
  const height = 32 + data.length * ROW_PX;

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-wrap gap-4 text-xs text-slate-700" aria-hidden>
        <li className="flex items-center gap-1.5">
          <span className="inline-block size-3 rounded-sm" style={{ background: OVERDUE }} /> Overdue
        </li>
        <li className="flex items-center gap-1.5">
          <span className="inline-block size-3 rounded-sm" style={{ background: ON_TIME }} /> Open, on time
        </li>
      </ul>

      <div aria-hidden style={{ height }}>
        {hydrated ? (
          <ResponsiveContainer width="100%" height={height}>
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 0, right: 32, bottom: 0, left: 0 }}
              barCategoryGap={10}
              accessibilityLayer={false}
            >
              <CartesianGrid horizontal={false} stroke="#e2e8f0" />
              <XAxis
                type="number"
                allowDecimals={false}
                tick={{ fontSize: 12, fill: "#475569" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={120}
                tick={{ fontSize: 12, fill: "#334155" }}
                axisLine={{ stroke: "#cbd5e1" }}
                tickLine={false}
              />
              <Tooltip content={<WorkloadTooltip />} cursor={{ fill: "#f1f5f9" }} isAnimationActive={false} />
              <Bar
                dataKey="overdue"
                stackId="open"
                fill={OVERDUE}
                stroke="#ffffff"
                strokeWidth={2}
                maxBarSize={18}
                isAnimationActive={false}
              />
              <Bar
                dataKey="onTime"
                stackId="open"
                fill={ON_TIME}
                stroke="#ffffff"
                strokeWidth={2}
                radius={[0, 4, 4, 0]}
                maxBarSize={18}
                isAnimationActive={false}
                shape={keepEmptyBar}
              >
                <LabelList dataKey="open" position="right" fontSize={12} fill="#334155" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : null}
      </div>

      <table className="sr-only">
        <caption>Open and overdue tasks per member</caption>
        <thead>
          <tr>
            <th scope="col">Member</th>
            <th scope="col">Open tasks</th>
            <th scope="col">Overdue</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.user.id}>
              <th scope="row">{r.user.name}</th>
              <td>{r.open}</td>
              <td>{r.overdue}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
