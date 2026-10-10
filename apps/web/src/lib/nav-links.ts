/**
 * The primary destinations, shared by the left rail (`RailNav`) and the top bar the
 * course and Arena pages use (`SiteNavLinks`) so the two cannot drift apart. Typed routes
 * are on, so these are literals rather than a widened string[].
 */
export const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/courses", label: "Courses" },
  { href: "/interview/new", label: "Mock interviews" },
  { href: "/arena", label: "Arena" },
  { href: "/history", label: "My reports" },
  { href: "/questions", label: "Questions" },
] as const;
