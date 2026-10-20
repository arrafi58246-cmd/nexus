import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import Navbar from "@/components/layout/Navbar";
import { endorsementWindow } from "@/lib/endorsement-window";
import { createClient } from "@/lib/supabase/server";
import { RESULT_OPTIONS } from "../result/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function LoadError({ displayName, avatarPath }: { displayName: string; avatarPath?: string | null }) {
  return (
    <div className="nexus-app-page min-h-screen bg-slate-50 text-slate-900">
      <Navbar displayName={displayName} avatarPath={avatarPath} activeItem="my-squad" />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <Link href="/my-squad" prefetch={false} className="font-bold text-indigo-700">← My Squad</Link>
        <p role="alert" className="mt-6">Detail Squad belum dapat dimuat. Muat ulang untuk mencoba lagi.</p>
      </main>
    </div>
  );
}

export default async function SquadEndorsementsPage({ params }: {
  params: Promise<{ squadId: string }>;
}) {
  const { squadId } = await params;
  if (!UUID.test(squadId)) notFound();
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) redirect("/login");

  const profile = await supabase.from("profiles")
    .select("nama_lengkap,role_app,status_akun,primary_class_id, foto_profil_path")
    .eq("user_id", auth.user.id).maybeSingle();
  if (profile.error) return <LoadError displayName="NEXUS" />;
  if (profile.data?.role_app === "ADMIN") redirect("/admin");
  if (!profile.data || profile.data.role_app !== "STUDENT" || profile.data.status_akun !== "ACTIVE") notFound();
  if (profile.data.primary_class_id === null) redirect("/onboarding");

  const [membership, squad] = await Promise.all([
    supabase.from("squad_members").select("squad_id")
      .eq("squad_id", squadId).eq("user_id", auth.user.id).limit(1).maybeSingle(),
    supabase.from("squads").select("nama_squad,status_squad,completed_at,mission_id")
      .eq("squad_id", squadId).maybeSingle(),
  ]);
  if (membership.error || squad.error) return <LoadError displayName={profile.data.nama_lengkap} avatarPath={profile.data.foto_profil_path} />;
  if (!membership.data || !squad.data || squad.data.status_squad !== "MISSION_COMPLETED") notFound();

  const [members, ratings, resultQuery] = await Promise.all([
    supabase.from("finalized_squad_members").select("user_id,status_member").eq("squad_id", squadId),
    supabase.from("endorsements").select("to_user_id")
      .eq("squad_id", squadId).eq("from_user_id", auth.user.id),
    supabase.from("mission_result_submissions")
      .select("status_validation,hasil_kompetisi,approved_hasil_kompetisi,xp_transactions(xp_amount)")
      .eq("squad_id", squadId).eq("xp_transactions.user_id", auth.user.id).maybeSingle(),
  ]);
  if (members.error || ratings.error) return <LoadError displayName={profile.data.nama_lengkap} avatarPath={profile.data.foto_profil_path} />;
  const memberIds = [...new Set((members.data ?? []).map(member => member.user_id))];
  const peerIds = memberIds.filter(id => id !== auth.user.id);
  const canRate = memberIds.includes(auth.user.id);
  const peers = peerIds.length > 0
    ? await supabase.from("public_profiles").select("user_id,nama_lengkap").in("user_id", peerIds)
    : { data: [], error: null };
  if (peers.error) return <LoadError displayName={profile.data.nama_lengkap} avatarPath={profile.data.foto_profil_path} />;
  const names = new Map((peers.data ?? []).map(peer => [peer.user_id, peer.nama_lengkap]));
  names.set(auth.user.id, `${profile.data.nama_lengkap} (Kamu)`);
  const rated = new Set((ratings.data ?? []).map(rating => rating.to_user_id));
  const window = endorsementWindow(squad.data.completed_at);
  const result = resultQuery.data as {
    status_validation: string; hasil_kompetisi: string; approved_hasil_kompetisi: string | null;
    xp_transactions: { xp_amount: number }[];
  } | null;
  const approved = result?.status_validation === "APPROVED";
  const resultLabel = approved ? RESULT_OPTIONS.find(option => option.value ===
    (result.approved_hasil_kompetisi ?? result.hasil_kompetisi))?.label : null;
  const transactions = approved ? result.xp_transactions ?? [] : [];
  const earnedXp = transactions.reduce((sum, transaction) => sum + transaction.xp_amount, 0);
  const canReadResultPage = (members.data ?? []).some(member =>
    member.user_id === auth.user.id && member.status_member === "ACTIVE");

  return (
    <div className="nexus-app-page min-h-screen bg-slate-50 text-slate-900">
      <Navbar displayName={profile.data.nama_lengkap} avatarPath={profile.data.foto_profil_path} activeItem="my-squad" />
      <main className="nexus-page-shell mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <Link href="/my-squad" prefetch={false} className="text-sm font-bold text-indigo-700">← My Squad</Link>
        <section className="glass-card mt-6 rounded-2xl border border-slate-200 bg-white p-6">
          <h1 className="text-2xl font-bold">Detail Squad</h1>
          <p className="mt-2 break-words font-semibold">{squad.data.nama_squad}</p>
          <p className="mt-2 text-sm text-slate-600">Mission Completed · Riwayat tim</p>
          <section aria-labelledby="squad-result-summary" className="mt-6 rounded-xl border border-slate-200 p-4">
            <h2 id="squad-result-summary" className="font-bold">Hasil dan XP</h2>
            {resultQuery.error ? (
              <p role="alert" className="mt-2 text-sm">Ringkasan hasil belum dapat dimuat. Coba muat ulang.</p>
            ) : (
              <>
                <p className="mt-2 text-sm">Hasil Squad: {resultLabel ?? "Belum ada hasil tervalidasi"}</p>
                <p className="mt-1 text-sm">XP kamu: {transactions.length > 0 ? `+${earnedXp} XP` : "Tidak tercatat"}</p>
              </>
            )}
            <div className="mt-3 flex flex-wrap gap-4 text-sm font-semibold text-indigo-700">
              {canReadResultPage && <Link href={`/squads/${squadId}/result`} prefetch={false}
                className="hover:underline">Lihat pengajuan hasil</Link>}
              <Link href={`/missions/${squad.data.mission_id}`} prefetch={false}
                className="hover:underline">Lihat Mission</Link>
            </div>
          </section>
          <h2 className="mt-6 text-lg font-bold">Anggota saat finalisasi</h2>
          <p className="mt-2 text-sm text-slate-600">
            Penilaian untuk anggota saat Squad difinalisasi, setelah hasil Mission disetujui admin. Penilaian tidak menambah XP.
          </p>
          {!canRate && <p className="mt-2 text-sm text-slate-600">Kamu bukan anggota saat finalisasi, sehingga tidak dapat memberi penilaian untuk Squad ini.</p>}
          <p className="mt-2 text-sm text-slate-600">
            {window.windowOpen && window.closesAt
              ? `Batas penilaian: ${new Intl.DateTimeFormat("id-ID", {
                  dateStyle: "long", timeStyle: "short", timeZone: "Asia/Jakarta",
                }).format(new Date(window.closesAt))} WIB.`
              : "Penilaian sudah ditutup. Profil dan penilaian yang tersimpan tetap dapat dilihat."}
          </p>
          {memberIds.length === 0 ? <p className="mt-6 text-sm">Data anggota saat finalisasi belum tersedia.</p> : (
            <ul className="mt-6 space-y-3">
              {memberIds.map(id => (
                <li key={id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4">
                  <div className="min-w-0">
                    <p className="break-words font-bold [overflow-wrap:anywhere]">{names.get(id) ?? "Profil rekan belum tersedia"}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {id === auth.user.id ? "Anggota tim saat finalisasi" : rated.has(id) ? "Sudah dinilai"
                        : !canRate ? "Penilaian tidak tersedia" : window.windowOpen ? "Belum dinilai" : "Penilaian ditutup"}
                    </p>
                  </div>
                  {id !== auth.user.id && names.has(id) && (
                    <Link href={`/profile/${id}?squad=${squadId}`} prefetch={false}
                      className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white">
                      {canRate && window.windowOpen && !rated.has(id) ? "Nilai rekan" : "Lihat profil"}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
