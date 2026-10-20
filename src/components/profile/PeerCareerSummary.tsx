import Image from "next/image";

import type { PeerReputation } from "@/lib/peer-reputation";

export default function PeerCareerSummary({ reputation }: { reputation: PeerReputation }) {
  return (
    <section className="profile-card pc-career" aria-label="Career Rank dan XP">
      <h2 className="text-sm font-bold">Career Rank</h2>
      <div className="mt-3 flex items-center gap-4">
        {reputation.rankIcon && <Image src={reputation.rankIcon} alt="" width={64} height={64} />}
        <div>
          {reputation.rankName ? <p className="text-xl font-bold">{reputation.rankName}</p>
            : <p role="alert" className="text-sm text-red-700">Career Rank belum dapat dimuat.</p>}
          {reputation.xp !== null ? (
            <p className="mt-1 text-sm font-semibold">{reputation.xp.toLocaleString("id-ID")} Career XP</p>
          ) : <p role="alert" className="mt-1 text-sm text-red-700">Career XP belum dapat dimuat.</p>}
        </div>
      </div>
    </section>
  );
}
