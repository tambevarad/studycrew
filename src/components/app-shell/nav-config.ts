import { Bell, CalendarClock, LayoutDashboard, Search, UserRound, type LucideIcon } from "lucide-react";

/**
 * SHARED CONTRACT: every screen in the app is already linked here and in team-tabs.ts,
 * so feature branches never edit navigation.
 */
export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Backlog item that owns the page behind this link. */
  owner: string;
  /** Highlight only on this exact path (not sub-paths). */
  exact?: boolean;
}

export const MAIN_NAV: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard, owner: "PB-12" },
  { href: "/teams", label: "Find teams", icon: Search, owner: "PB-04", exact: true },
  { href: "/availability", label: "My availability", icon: CalendarClock, owner: "PB-03" },
  { href: "/notifications", label: "Notifications", icon: Bell, owner: "PB-08" },
  { href: "/profile", label: "Profile", icon: UserRound, owner: "PB-02" },
];
