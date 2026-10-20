import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { notificationNavSection, type NavSection } from "@/lib/notifications";
import LogoutButton from "./LogoutButton";
import NotificationBell from "./NotificationBell";

type NavbarProps = {
  displayName: string;
  avatarPath?: string | null;
  activeItem: "home" | "missions" | "leaderboard" | "my-squad" | "admin" | "notifications" | "profile";
  isAdmin?: boolean;
};

async function loadUnread(): Promise<{ count: number; sections: Set<NavSection> }> {
  const empty = { count: 0, sections: new Set<NavSection>() };
  try {
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return empty;
    const { data, error } = await supabase.from("notifications").select("notification_type")
      .eq("user_id", auth.user.id).eq("is_read", false).limit(100);
    if (error || !data) return empty;
    const sections = new Set<NavSection>();
    for (const row of data) {
      const section = notificationNavSection(row.notification_type);
      if (section) sections.add(section);
    }
    return { count: data.length, sections };
  } catch {
    return empty; // The navbar must never break a page because of the badge.
  }
}

export default async function Navbar({ displayName, avatarPath, activeItem, isAdmin = false }: NavbarProps) {
  const unread = isAdmin ? { count: 0, sections: new Set<NavSection>() } : await loadUnread();
  const avatarUrl = avatarPath
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${avatarPath.split("/").map(encodeURIComponent).join("/")}`
    : null;
  const items = isAdmin ? [{ href: "/admin", key: "admin", label: "Panel Admin" }] : [
    { href: "/", key: "home", label: "Home" },
    { href: "/missions", key: "missions", label: "Missions" },
    { href: "/leaderboard", key: "leaderboard", label: "Leaderboard" },
    { href: "/my-squad", key: "my-squad", label: "My Squad" },
  ];
  return (
    <header className="nexus-navbar">
      <div className="nexus-nav-inner">
        <Link href={isAdmin ? "/admin" : "/"} className="nexus-brand" aria-label={isAdmin ? "NEXUS Panel Admin" : "NEXUS Home"}>
          <Image src="/nexus-logo.svg" alt="" width={28} height={28} />
        </Link>
        <nav className="nexus-nav-links" aria-label="Navigasi utama">
          {items.map((item) => <Link key={item.key} href={item.href} className="nexus-nav-link"
            aria-current={activeItem === item.key ? "page" : undefined}>
            {item.label}
            {(item.key === "missions" || item.key === "my-squad") && unread.sections.has(item.key) &&
              <span className="nexus-dot" role="img" aria-label="Ada notifikasi baru" />}
          </Link>)}
        </nav>
        <div className="nexus-nav-actions">
          {!isAdmin && <>
          <NotificationBell count={unread.count} current={activeItem === "notifications"} />
          <Link href="/profile" className="nexus-avatar" title={displayName}
            aria-label={`Buka profil ${displayName || "saya"}`}
            aria-current={activeItem === "profile" ? "page" : undefined}>
            {avatarUrl ? <Image src={avatarUrl} alt="" width={44} height={44} unoptimized
              className="h-full w-full rounded-full object-cover" /> : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" aria-hidden="true">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
              </svg>
            )}
          </Link>
          </>}
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
