import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import Navbar from "@/components/layout/Navbar";
import BadgePill from "@/components/profile/BadgePill";
import EndorsementPanel from "@/components/profile/EndorsementPanel";
import MissionHistoryList from "@/components/profile/MissionHistoryList";
import PeerCareerSummary from "@/components/profile/PeerCareerSummary";
import ProfileHero from "@/components/profile/ProfileHero";
import RankSwitcherCard from "@/components/profile/RankSwitcherCard";
import XpProgressCard from "@/components/profile/XpProgressCard";
import { badgeTone, facultyAbbreviation } from "@/lib/badges";
import { loadEndorsementSummary, loadSharedCompletedSquads } from "@/lib/endorsements";
import { loadPeerReputation } from "@/lib/peer-reputation";
import { createClient } from "@/lib/supabase/server";
import EndorsementForm from "./EndorsementForm";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PeerProfilePage({ params, searchParams }: {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ squad?: string | string[]; mission?: string | string[] }>;
}) {
  const [{ userId }, query] = await Promise.all([params, searchParams]);
  if (!UUID.test(userId)) notFound();

  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) redirect("/login");
  if (auth.user.id === userId) redirect("/profile");

  const viewerResult = await supabase.from("profiles")
    .select("nama_lengkap, role_app, status_akun, foto_profil_path")
    .eq("user_id", auth.user.id).maybeSingle();
  if (!viewerResult.error && viewerResult.data?.role_app === "ADMIN") redirect("/admin");
  if (viewerResult.error || !viewerResult.data || viewerResult.data.status_akun !== "ACTIVE") {
    notFound();
  }
  const peerResult = await supabase.from("public_profiles")
    .select("nama_lengkap, bio, tahun_masuk, foto_profil_path, primary_class_id, program_studi_id")
    .eq("user_id", userId).maybeSingle();
  if (peerResult.error || !peerResult.data) notFound();

  const peer = peerResult.data;
  const [classResult, programResult, summary, sharedSquads, skillsResult, reputation] = await Promise.all([
    peer.primary_class_id === null
      ? Promise.resolve({ data: null, error: null })
      : supabase.from("primary_classes").select("nama_class")
          .eq("primary_class_id", peer.primary_class_id).maybeSingle(),
    supabase.from("program_studi").select("nama_program_studi, fakultas_id")
      .eq("program_studi_id", peer.program_studi_id).maybeSingle(),
    loadEndorsementSummary(supabase, userId),
    viewerResult.data.role_app === "STUDENT"
      ? loadSharedCompletedSquads(supabase, auth.user.id, userId)
      : Promise.resolve([]),
    supabase.from("user_skills").select("skills(nama_skill)").eq("user_id", userId),
    loadPeerReputation(supabase, userId),
  ]);
  const facultyResult = programResult.data
    ? await supabase.from("fakultas").select("nama_fakultas")
        .eq("fakultas_id", programResult.data.fakultas_id).maybeSingle()
    : { data: null, error: null };
  const avatar = peer.foto_profil_path
    ? supabase.storage.from("avatars").getPublicUrl(peer.foto_profil_path).data.publicUrl
    : null;
  const context = typeof query.squad === "string" && UUID.test(query.squad)
    ? sharedSquads?.find(squad => squad.squadId === query.squad)
    : undefined;
  // This parameter only selects an internal return link, never access or eligibility.
  const missionId = typeof query.mission === "string" && UUID.test(query.mission)
    ? query.mission : null;
  const skills = (skillsResult.data ?? []).flatMap((row) => row.skills ?? [])
    .map((skill) => skill.nama_skill).sort((a, b) => a.localeCompare(b));

  const badge = reputation.badge;
  const badgeNode = reputation.badgeFailed ? (
    <span role="alert" className="history2-note history2-note--error">Badge terpasang belum dapat dimuat.</span>
  ) : badge ? (
    <>
      <BadgePill scope={badge.scope} tier={badge.tier} detail={badge.detail}>{badge.label}</BadgePill>
      <span className="history2-note">Badge terpasang · {badge.detail}</span>
    </>
  ) : <span className="history2-note">Belum ada Badge terpasang.</span>;

  const tags = [
    classResult.data?.nama_class,
    facultyResult.data ? facultyAbbreviation(facultyResult.data.nama_fakultas) : null,
    programResult.data?.nama_program_studi,
    `UNESA ${peer.tahun_masuk}`,
  ].filter((tag): tag is string => Boolean(tag));

  const rules = reputation.rules;
  const xpReady = reputation.xp !== null && reputation.rankName !== null && rules.length > 0;

  return (
    <div className="nexus-app-page min-h-screen bg-slate-50 text-slate-900">
      <Navbar displayName={viewerResult.data.nama_lengkap} avatarPath={viewerResult.data.foto_profil_path} activeItem={missionId ? "missions" : context ? "my-squad" : "leaderboard"} />
      <main className="nexus-page-shell profile-v2 mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <Link href={missionId ? `/missions/${missionId}` : context ? `/squads/${context.squadId}/endorsements` : "/leaderboard"}
          prefetch={false} className="profile-back">
          {missionId ? "← Kembali ke Mission" : context ? `← Detail ${context.name}` : "← Leaderboard"}
        </Link>

        <ProfileHero name={peer.nama_lengkap} avatarUrl={avatar} tone={badgeTone(badge)}
          badge={badgeNode} tags={tags} bio={peer.bio?.trim() || "Belum ada bio."} />

        <div className="profile-grid profile-grid--peer">
          {xpReady && reputation.xp !== null ? (
            <>
              <XpProgressCard area="pc-career" tone="career" title="Career XP"
                subtitle="XP Career Total" xp={reputation.xp} rules={rules} />
              <RankSwitcherCard area="pc-rank" rules={rules}
                options={[{ key: "career", label: "Career Rank", xp: reputation.xp }]} />
            </>
          ) : (
            <PeerCareerSummary reputation={reputation} />
          )}

          <section className="profile-card pc-skills" aria-label="Skills">
            <h2>Skills</h2>
            {skillsResult.error ? (
              <p role="alert" className="history2-note">Skill belum dapat dimuat. Coba muat ulang halaman.</p>
            ) : skills.length > 0 ? (
              <ul className="skills2-list">
                {skills.map((skill) => <li key={skill}>{skill}</li>)}
              </ul>
            ) : <p className="history2-note">Belum ada Skill yang dipilih.</p>}
          </section>

          <section className="profile-card pc-missions" aria-label="Riwayat Mission terverifikasi">
            <h2>Riwayat Mission terverifikasi</h2>
            <p className="history2-note">Maksimal 3 hasil terbaru yang telah disetujui dan menghasilkan XP.</p>
            {reputation.history === null ? (
              <p role="alert" className="history2-note history2-note--error">Riwayat Mission belum dapat dimuat. Coba muat ulang.</p>
            ) : reputation.history.length === 0 ? (
              <p className="history2-note">Belum ada hasil atau prestasi terverifikasi.</p>
            ) : <MissionHistoryList items={reputation.history} />}
          </section>

          <EndorsementPanel area="pc-endorse" summary={summary}>
            {sharedSquads === null ? (
              <p role="alert" className="endorse2-note endorse2-note--error">
                Ketersediaan penilaian belum dapat diperiksa. Coba muat ulang.
              </p>
            ) : sharedSquads.length > 0 ? (
              <EndorsementForm key={context?.squadId ?? "all-squads"} targetUserId={userId}
                squads={context ? [context] : sharedSquads} />
            ) : null}
          </EndorsementPanel>
        </div>
      </main>
    </div>
  );
}
