import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import Navbar from "@/components/layout/Navbar";
import { createClient } from "@/lib/supabase/server";

import SquadChat from "./SquadChat";
import FinalizeSquadButton from "./FinalizeSquadButton";
import MembershipActions from "./MembershipActions";
import TransferLeadershipButton from "./TransferLeadershipButton";
import DisbandSquadButton from "./DisbandSquadButton";
import type { RoomMember, RoomMessage } from "./types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type SquadRoomPageProps = {
  params: Promise<{ squadId: string }>;
};

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Belum tersedia"
    : new Intl.DateTimeFormat("id-ID", {
        dateStyle: "long",
        timeZone: "Asia/Jakarta",
      }).format(date);
}

function formatLabel(value: string): string {
  return value.replaceAll("_", " ").toLocaleLowerCase("id-ID");
}

function PageMessage({
  displayName,
  avatarPath,
  title,
  description,
}: {
  displayName: string;
  avatarPath?: string | null;
  title: string;
  description: string;
}) {
  return (
    <div className="nexus-app-page flex min-h-screen flex-col bg-slate-50">
      <Navbar displayName={displayName} avatarPath={avatarPath} activeItem="my-squad" />
      <main className="flex flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <h1 className="text-2xl font-bold text-slate-950">{title}</h1>
          <p className="mt-3 text-sm text-slate-600">{description}</p>
          <Link href="/my-squad" className="mt-5 inline-flex font-bold text-indigo-600">
            Kembali ke My Squad
          </Link>
        </div>
      </main>
    </div>
  );
}

export default async function SquadRoomPage({ params }: SquadRoomPageProps) {
  const { squadId } = await params;
  if (!UUID_PATTERN.test(squadId)) notFound();

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) redirect("/login");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("nama_lengkap, role_app, primary_class_id, status_akun, foto_profil_path")
    .eq("user_id", authData.user.id)
    .maybeSingle();
  if (!profileError && profile?.role_app === "ADMIN") redirect("/admin");

  if (profileError || !profile) {
    return <PageMessage displayName="NEXUS" title="Room belum dapat dimuat" description="Profil sedang tidak tersedia." />;
  }
  if (profile.primary_class_id === null) redirect("/onboarding");
  if (profile.status_akun !== "ACTIVE") {
    return <PageMessage displayName={profile.nama_lengkap} avatarPath={profile.foto_profil_path} title="Akses Squad dibatasi" description="Akunmu sedang tidak aktif." />;
  }

  const { data: membership, error: membershipError } = await supabase
    .from("squad_members")
    .select("squad_member_id")
    .eq("squad_id", squadId)
    .eq("user_id", authData.user.id)
    .eq("status_member", "ACTIVE")
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    return <PageMessage displayName={profile.nama_lengkap} avatarPath={profile.foto_profil_path} title="Room belum dapat dimuat" description="Keanggotaan Squad belum dapat diperiksa." />;
  }
  if (!membership) notFound();

  const { data: squad, error: squadError } = await supabase
    .from("squads")
    .select("squad_id, mission_id, nama_squad, deskripsi_squad, kapasitas_anggota, status_squad")
    .eq("squad_id", squadId)
    .maybeSingle();

  if (squadError || !squad) {
    return <PageMessage displayName={profile.nama_lengkap} avatarPath={profile.foto_profil_path} title="Room belum dapat dimuat" description="Data Squad sedang tidak tersedia." />;
  }

  if (squad.status_squad === "MISSION_COMPLETED") {
    redirect(`/squads/${squadId}/endorsements`);
  }
  if (squad.status_squad === "DISBANDED") {
    return <PageMessage displayName={profile.nama_lengkap} avatarPath={profile.foto_profil_path} title="Room Squad telah ditutup" description="Mission ini sudah selesai. Riwayat Squad tetap tersedia di My Squad." />;
  }

  const [missionResult, membersResult, messagesResult] = await Promise.all([
    supabase
      .from("missions")
      .select("nama_lomba, penyelenggara, cakupan_peserta, biaya_pendaftaran, mode_lomba, deadline_lomba, min_anggota_tim, mission_tiers(kode_tier)")
      .eq("mission_id", squad.mission_id)
      .maybeSingle(),
    supabase.rpc("get_squad_room_members", { p_squad_id: squadId }),
    supabase
      .from("squad_messages")
      .select("message_id, sender_id, content, created_at")
      .eq("squad_id", squadId)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  if (missionResult.error || !missionResult.data || membersResult.error || messagesResult.error) {
    return <PageMessage displayName={profile.nama_lengkap} avatarPath={profile.foto_profil_path} title="Room belum dapat dimuat" description="Data Mission, anggota, atau chat sedang tidak tersedia." />;
  }

  const mission = missionResult.data;
  const members = (membersResult.data ?? []) as RoomMember[];
  const messages = ((messagesResult.data ?? []) as RoomMessage[]).reverse();
  const currentMember = members.find(
    (member) => member.member_user_id === authData.user.id,
  );
  const canChangeMembership = ["OPEN_RECRUITMENT", "FULL"].includes(
    squad.status_squad,
  );
  const isLeader = currentMember?.role_squad === "KETUA";
  const tier = Array.isArray(mission.mission_tiers)
    ? mission.mission_tiers[0]
    : mission.mission_tiers;

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Navbar displayName={profile.nama_lengkap} avatarPath={profile.foto_profil_path} activeItem="my-squad" />
      <main className="nexus-page-shell squad-room-page mx-auto w-full max-w-6xl px-4 py-8 text-slate-900 sm:px-6">
        <Link href="/my-squad" className="text-sm font-bold text-indigo-600 hover:text-indigo-700">
          ← Kembali ke My Squad
        </Link>
        <header className="glass-card squad-room-hero mt-6 rounded-2xl border border-indigo-100 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">Squad Room</p>
          <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold text-slate-950">{squad.nama_squad}</h1>
              <p className="mt-2 text-sm text-slate-600">{squad.deskripsi_squad}</p>
            </div>
            <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">
              {formatLabel(squad.status_squad)}
            </span>
          </div>
          <p className="mt-4 text-sm font-semibold text-slate-700">
            {members.length}/{squad.kapasitas_anggota} anggota aktif · {mission.nama_lomba}
          </p>
        </header>

        <div className="squad-room-grid mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
          <SquadChat
            squadId={squadId}
            currentUserId={authData.user.id}
            members={members}
            initialMessages={messages}
          />
          <aside className="space-y-6">
            {canChangeMembership && isLeader && members.length === 1 && <DisbandSquadButton squadId={squadId} />}
            {squad.status_squad === "FINALIZED" && (
              <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="text-lg font-bold text-slate-950">Hasil Mission</h2>
                <p className="my-3 text-sm text-slate-600">
                  Ketua mengirim hasil dan sertifikat untuk diverifikasi admin.
                  Anggota dapat melihat status pengajuan.
                </p>
                <Link href={`/squads/${squadId}/result`}
                  className="inline-flex rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white">
                  {isLeader ? "Kirim / Lihat Hasil" : "Lihat Status Hasil"}
                </Link>
              </section>
            )}
            {canChangeMembership && isLeader && (
              <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="text-lg font-bold text-slate-950">Finalisasi Squad</h2>
                <p className="my-3 text-sm text-slate-600">
                  Setelah finalisasi, perekrutan dan perubahan anggota terkunci.
                  Lamaran Pending tidak menghalangi finalisasi.
                </p>
                <FinalizeSquadButton
                  squadId={squadId}
                  activeCount={members.length}
                  minimumCount={mission.min_anggota_tim}
                />
              </section>
            )}
            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="text-lg font-bold text-slate-950">Mission</h2>
              <p className="mt-3 font-semibold">{mission.nama_lomba}</p>
              <p className="mt-1 text-sm text-slate-600">{mission.penyelenggara}</p>
              <dl className="mt-4 space-y-2 text-sm text-slate-600">
                <div><dt className="inline font-semibold">Tier: </dt><dd className="inline">{tier?.kode_tier ?? "Belum tersedia"}</dd></div>
                <div><dt className="inline font-semibold">Cakupan: </dt><dd className="inline">{formatLabel(mission.cakupan_peserta)}</dd></div>
                <div><dt className="inline font-semibold">Mode: </dt><dd className="inline">{formatLabel(mission.mode_lomba)}</dd></div>
                <div><dt className="inline font-semibold">Biaya: </dt><dd className="inline">{formatLabel(mission.biaya_pendaftaran)}</dd></div>
                <div><dt className="inline font-semibold">Deadline lomba: </dt><dd className="inline">{formatDate(mission.deadline_lomba)}</dd></div>
              </dl>
              <Link href={`/missions/${squad.mission_id}`} className="mt-4 inline-flex text-sm font-bold text-indigo-600">
                Lihat Mission
              </Link>
            </section>
            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="text-lg font-bold text-slate-950">Anggota Squad</h2>
              {canChangeMembership && isLeader && (
                <p className="mt-3 text-sm text-slate-600">
                  Untuk keluar, transfer kepemimpinan ke anggota aktif terlebih dahulu.
                  Setelah transfer, kamu tetap menjadi anggota dan dapat memilih Keluar Squad.
                  {members.length === 1 ? " Kamu juga dapat membubarkan Squad melalui tombol di atas." : ""}
                </p>
              )}
              <ul className="mt-4 space-y-3">
                {members.map((member) => (
                  <li key={member.member_user_id} className="rounded-xl bg-slate-50 p-3 text-sm">
                    <p className="font-bold text-slate-900">
                      {member.nama_lengkap}
                      {member.member_user_id === authData.user.id ? " (Kamu)" : ""}
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      {member.role_squad === "KETUA" ? "Ketua" : "Anggota"}
                      {" · "}
                      {member.nama_class ?? "Class belum tersedia"}
                    </p>
                    {canChangeMembership && isLeader && member.role_squad === "ANGGOTA" && (
                      <TransferLeadershipButton
                        squadId={squadId}
                        memberUserId={member.member_user_id}
                        memberName={member.nama_lengkap}
                      />
                    )}
                    {canChangeMembership && isLeader && member.role_squad === "ANGGOTA" && (
                      <MembershipActions
                        squadId={squadId}
                        memberUserId={member.member_user_id}
                        memberName={member.nama_lengkap}
                      />
                    )}
                  </li>
                ))}
              </ul>
              {canChangeMembership && currentMember?.role_squad === "ANGGOTA" && (
                <MembershipActions squadId={squadId} />
              )}
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}

