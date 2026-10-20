// Maps a notification_type to the page that can act on it. The notifications table has no
// link column, so destinations are derived from the type; unknown types simply do not link.
const DESTINATIONS: Record<string, string> = {
  SQUAD_APPLICATION_ACCEPTED: "/my-squad",
  SQUAD_APPLICATION_REJECTED: "/missions",
  SQUAD_DISBANDED: "/my-squad",
  SQUAD_MEMBER_KICKED: "/my-squad",
  SQUAD_MEMBER_ADMIN_REMOVED: "/my-squad",
  MISSION_SUBMISSION_APPROVED: "/missions",
  MISSION_SUBMISSION_REJECTED: "/missions/submissions",
  MISSION_RESULT_APPROVED: "/my-squad",
  MISSION_RESULT_REJECTED: "/my-squad",
  ACHIEVEMENT_APPROVED: "/profile/claims",
  ACHIEVEMENT_REJECTED: "/profile/claims",
};

export function notificationHref(type: string | null | undefined): string | null {
  return (type && Object.hasOwn(DESTINATIONS, type) ? DESTINATIONS[type] : null);
}

export type NavSection = "missions" | "my-squad";

// Which main-navigation item should show a dot for an unread notification of this type.
export function notificationNavSection(type: string | null | undefined): NavSection | null {
  const href = notificationHref(type);
  if (!href) return null;
  if (href.startsWith("/missions")) return "missions";
  if (href.startsWith("/my-squad")) return "my-squad";
  return null;
}
