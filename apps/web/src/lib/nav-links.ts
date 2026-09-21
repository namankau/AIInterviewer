/**
 * The primary destinations, shared by the left rail (`RailNav`) and the top bar the
 * course and Arena pages use (`SiteNavLinks`) so the two cannot drift apart. Typed routes
 * are on, so these are literals rather than a widened string[].
 */
export const NAV_LINKS = [
  { href: "/dashboard", label: "Home" },
  { href: "/rounds", label: "Rounds" },
  { href: "/questions", label: "Questions" },
  { href: "/courses", label: "Courses" },
  { href: "/arena", label: "Arena" },
  { href: "/profile", label: "Profile" },
] as const;
