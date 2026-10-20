import Image from "next/image";
import Link from "next/link";
import type { LeaderboardEntry } from "@/app/leaderboard/types";
import RankCard, { type RankRule } from "@/app/profile/RankCard";

export type ActiveMission = {
  squadId: string;
  squadName: string;
  missionId: string;
  title: string;
  tier: string | null;
  scope: string | null;
  cost: string | null;
};

export type DashboardProps = {
  name: string;
  careerXp: number | null;
  seasonalXp: number | null;
  rules: RankRule[];
  seasonName: string | null;
  xpError: boolean;
  missions: ActiveMission[];
  missionsError: boolean;
  leaders: Array<LeaderboardEntry & { avatarUrl: string | null }>;
  leadersError: boolean;
};

export default function Dashboard(props: DashboardProps) {
  return (
    <main className="nexus-dashboard">
      <header className="dashboard-greeting">
        <h1>Selamat Datang</h1><p>{props.name}!</p>
      </header>
      <div className="dashboard-grid">
        <div className="dashboard-left">
          <div className="dashboard-xp">
            {props.xpError ? <section className="glass-card nexus-message col-span-2" role="alert">XP belum dapat dimuat. Coba muat ulang halaman.</section> : <>
              {props.seasonName && props.seasonalXp !== null
                ? <RankCard label="Season XP" xp={props.seasonalXp} rules={props.rules} />
                : <section className="glass-card xp-card"><h2>Season XP</h2><p className="nexus-message">Belum ada season aktif.</p></section>}
              {props.careerXp !== null && <RankCard label="Career XP" xp={props.careerXp} rules={props.rules} />}
            </>}
          </div>
          <section className="glass-card dashboard-panel">
            <h2>Mission Aktif</h2>
            {props.missionsError ? <p className="nexus-message" role="alert">Misi aktif belum dapat dimuat. Coba muat ulang halaman.</p>
              : props.missions.length ? props.missions.map((mission) => (
                <Link key={mission.squadId} href={`/squads/${mission.squadId}`} className="active-mission block transition hover:bg-white/20">
                  <div className="flex items-start justify-between gap-3">
                    <h3>{mission.title}</h3>
                    {mission.tier && <span className="nexus-pill shrink-0">{mission.tier}-Rank</span>}
                  </div>
                  <p>{[mission.scope, mission.cost].filter(Boolean).map((value) => value?.replaceAll("_", " ")).join(" · ")}</p>
                  <span className="nexus-pill mt-2">Squad: {mission.squadName}</span>
                </Link>
              )) : <p className="nexus-message">Belum ada misi aktif. <Link href="/missions" className="underline">Temukan misi pertamamu ↗</Link></p>}
            <Link href="/my-squad" className="dashboard-more">Lihat Selengkapnya ↗</Link>
          </section>
        </div>
        <section className="glass-card dashboard-leaderboard">
          <header><h2>Leaderboard</h2><p>Program Studi</p>{props.seasonName && <p className="mt-1 text-xs text-slate-500">{props.seasonName}</p>}</header>
          {props.leadersError ? <p className="nexus-message" role="alert">Leaderboard belum dapat dimuat. Coba muat ulang halaman.</p>
            : !props.seasonName ? <p className="nexus-message">Peringkat tersedia saat season aktif.</p>
            : props.leaders.length ? <ol>{props.leaders.map((leader) => (
              <li key={leader.user_id}>
                <Link href={`/profile/${leader.user_id}`}>
                  <span className="leader-position">{leader.rank_position}.</span>
                  {leader.avatarUrl ? <Image src={leader.avatarUrl} alt="" width={44} height={44} unoptimized className="nexus-avatar object-cover" />
                    : <span className="nexus-avatar">{leader.nama_lengkap.trim().split(/\s+/).slice(0,2).map((part) => part[0]).join("").toUpperCase()}</span>}
                  <span className="leader-name"><strong>{leader.nama_lengkap}</strong><small>{leader.nama_class ?? "Class belum dipilih"}</small></span>
                  <span className="leader-xp">{new Intl.NumberFormat("id-ID").format(leader.seasonal_xp)} XP</span>
                </Link>
              </li>
            ))}</ol> : <p className="nexus-message">Belum ada peringkat pada program studi ini.</p>}
          <Link href="/leaderboard?scope=PROGRAM_STUDI" className="dashboard-more">Lihat Selengkapnya ↗</Link>
        </section>
      </div>
    </main>
  );
}
