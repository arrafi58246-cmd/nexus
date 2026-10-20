import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { RANK_ICONS, type BadgeScope, type RankTier } from "@/lib/badges";

function Crown() {
  return (
    <svg viewBox="0 0 28 24" aria-hidden="true" className="badge-pill-crown">
      <path d="M2 7.5l6.2 5.3L14 3l5.8 9.8L26 7.5 24 20.5H4L2 7.5z" fill="#ffd54f" stroke="#e7a92a" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M4.6 17.4h18.8" stroke="#fff3bf" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

const TONES: Record<BadgeScope, string> = {
  UNIVERSITAS: "univ", FAKULTAS: "fakultas", PROGRAM_STUDI: "prodi",
};

/**
 * Pill for the equipped badge. Gold = Universitas, blue = Fakultas, green = Program Studi;
 * Rank-Up badges use a neutral navy pill with the tier shield.
 */
export default function BadgePill({ scope, tier, detail, href, size = "md", children }: {
  scope: BadgeScope | null;
  tier?: RankTier | null;
  detail?: string;
  href?: string;
  size?: "sm" | "md";
  children: ReactNode;
}) {
  const className = `badge-pill badge-pill--${scope ? TONES[scope] : "rank"}${size === "sm" ? " badge-pill--sm" : ""}`;
  const content = (
    <>
      {scope ? <Crown /> : tier ? (
        <Image src={RANK_ICONS[tier]} alt="" width={22} height={22} className="badge-pill-rank" />
      ) : null}
      <span>{children}</span>
    </>
  );
  return href
    ? <Link href={href} prefetch={false} className={className} title={detail}>{content}</Link>
    : <span className={className} title={detail}>{content}</span>;
}
