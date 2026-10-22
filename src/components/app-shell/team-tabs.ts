/** SHARED CONTRACT: tabs under /teams/[teamId]. Paths are relative to the team root. */
export const TEAM_TABS = [
  { segment: "", label: "Overview", owner: "PB-12" },
  { segment: "board", label: "Board", owner: "PB-05" },
  { segment: "calendar", label: "Calendar", owner: "PB-06" },
  { segment: "resources", label: "Resources", owner: "PB-07" },
  { segment: "coverage", label: "AI Coverage Check", owner: "PB-10" },
  { segment: "milestones", label: "Milestones", owner: "PB-13" },
  { segment: "polls", label: "Polls", owner: "PB-14" },
  { segment: "activity", label: "Activity", owner: "PB-09" },
  { segment: "members", label: "Members", owner: "PB-04" },
] as const;
