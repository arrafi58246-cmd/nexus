import { redirect } from "next/navigation";

import Navbar from "@/components/layout/Navbar";
import { createClient } from "@/lib/supabase/server";

import SquadCard from "./SquadCard";
import { getTierCode } from "./formatters";
import type {
  MissionResultRow,
  MissionRow,
  MissionXpRow,
  MySquadItem,
  SquadMembershipRow,
  SquadRow,
} from "./types";

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function PageMessage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 text-slate-900">
      <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-200/60">
        <p className="text-sm font-bold tracking-[0.22em] text-indigo-600">
          NEXUS
        </p>
        <h1 className="mt-4 text-2xl font-bold text-slate-950">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
      </section>
    </main>
  );
}

function EmptyState({ description }: { description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-6 text-center sm:p-8">
      <p className="text-sm leading-6 text-slate-500">{description}</p>
    </div>
  );
}

export default async function MySquadPage() {
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
    return (
      <PageMessage
        title="My Squad belum dapat dimuat"
        description="Data profil sedang tidak tersedia."
      />
    );
  }

  if (profile.primary_class_id === null) redirect("/onboarding");
  if (profile.status_akun !== "ACTIVE") {
    return (
      <PageMessage
        title="Akses My Squad dibatasi"
        description="Akunmu sedang tidak aktif. Hubungi admin NEXUS untuk bantuan."
      />
    );
  }

  const { data: membershipData, error: membershipError } = await supabase
    .from("squad_members")
    .select(
      "squad_member_id, squad_id, mission_id, role_squad, status_member, joined_at, ended_at",
    )
    .eq("user_id", authData.user.id)
    .order("joined_at", { ascending: false });

  if (membershipError) {
    return (
      <PageMessage
        title="My Squad belum dapat dimuat"
        description="Riwayat keanggotaan Squad sedang tidak tersedia."
      />
    );
  }

  const memberships = (membershipData ?? []) as SquadMembershipRow[];
  const squadIds = uniqueStrings(memberships.map((item) => item.squad_id));
  const missionIds = uniqueStrings(memberships.map((item) => item.mission_id));

  let items: MySquadItem[] = [];
  let historyDetailsLoadFailed = false;

  if (memberships.length > 0) {
    const [
      squadsResult,
      missionsResult,
      activeMembersResult,
      missionResultsResult,
      missionXpResult,
    ] = await Promise.all([
      supabase
        .from("squads")
        .select(
          "squad_id, mission_id, nama_squad, kapasitas_anggota, status_squad, completed_at",
        )
        .in("squad_id", squadIds),
      supabase
        .from("missions")
        .select(
          `
            mission_id,
            nama_lomba,
            penyelenggara,
            cakupan_peserta,
            mode_lomba,
            biaya_pendaftaran,
            mission_tiers (
              kode_tier
            )
          `,
        )
        .in("mission_id", missionIds),
      supabase
        .from("squad_members")
        .select("squad_id")
        .in("squad_id", squadIds)
        .eq("status_member", "ACTIVE"),
      supabase
        .from("mission_result_submissions")
        .select(
          "result_submission_id, squad_id, hasil_kompetisi, status_validation",
        )
        .in("squad_id", squadIds),
      supabase
        .from("xp_transactions")
        .select("mission_result_submission_id, xp_amount, earned_at")
        .eq("user_id", authData.user.id)
        .eq("xp_source_type", "VERIFIED_MISSION"),
    ]);

    if (
      squadsResult.error ||
      missionsResult.error ||
      activeMembersResult.error
    ) {
      return (
        <PageMessage
          title="My Squad belum dapat dimuat"
          description="Data Squad atau Mission sedang tidak tersedia."
        />
      );
    }

    historyDetailsLoadFailed = Boolean(
      missionResultsResult.error || missionXpResult.error,
    );

    const squads = (squadsResult.data ?? []) as SquadRow[];
    const missions = (missionsResult.data ?? []) as MissionRow[];
    const missionResults = (missionResultsResult.data ?? []) as MissionResultRow[];
    const missionXp = (missionXpResult.data ?? []) as MissionXpRow[];
    const squadById = new Map(squads.map((squad) => [squad.squad_id, squad]));
    const missionById = new Map(
      missions.map((mission) => [mission.mission_id, mission]),
    );
    const resultBySquadId = new Map(
      missionResults.map((result) => [result.squad_id, result]),
    );
    const activeMemberCountBySquadId = new Map<string, number>();
    const xpByResultId = new Map<
      string,
      { amount: number; earnedAt: string }
    >();

    for (const member of activeMembersResult.data ?? []) {
      activeMemberCountBySquadId.set(
        member.squad_id,
        (activeMemberCountBySquadId.get(member.squad_id) ?? 0) + 1,
      );
    }

    for (const transaction of missionXp) {
      if (!transaction.mission_result_submission_id) continue;

      const current = xpByResultId.get(
        transaction.mission_result_submission_id,
      );
      xpByResultId.set(transaction.mission_result_submission_id, {
        amount: (current?.amount ?? 0) + transaction.xp_amount,
        earnedAt: current?.earnedAt ?? transaction.earned_at,
      });
    }

    items = memberships.flatMap((membership) => {
      const squad = squadById.get(membership.squad_id);
      const mission = missionById.get(membership.mission_id);

      if (!squad || !mission) return [];

      const result = resultBySquadId.get(squad.squad_id);
      const approvedResult =
        result?.status_validation === "APPROVED" ? result : null;
      const xp = approvedResult
        ? xpByResultId.get(approvedResult.result_submission_id)
        : undefined;

      return [
        {
          membershipId: membership.squad_member_id,
          squadId: squad.squad_id,
          missionId: mission.mission_id,
          squadName: squad.nama_squad,
          missionName: mission.nama_lomba,
          organizer: mission.penyelenggara,
          tierCode: getTierCode(mission.mission_tiers),
          scope: mission.cakupan_peserta,
          mode: mission.mode_lomba,
          cost: mission.biaya_pendaftaran,
          capacity: squad.kapasitas_anggota,
          activeMemberCount:
            activeMemberCountBySquadId.get(squad.squad_id) ?? 0,
          squadStatus: squad.status_squad,
          role: membership.role_squad,
          membershipStatus: membership.status_member,
          joinedAt: membership.joined_at,
          historyDate: membership.ended_at ?? squad.completed_at,
          verifiedResult: approvedResult?.hasil_kompetisi ?? null,
          earnedXp: xp?.amount ?? null,
          xpEarnedAt: xp?.earnedAt ?? null,
        } satisfies MySquadItem,
      ];
    });

    if (items.length !== memberships.length) {
      return (
        <PageMessage
          title="My Squad belum dapat dimuat"
          description="Sebagian relasi Squad atau Mission tidak dapat dibaca."
        />
      );
    }
  }

  const activeItems = items.filter(
    (item) =>
      item.membershipStatus === "ACTIVE" &&
      !["MISSION_COMPLETED", "DISBANDED"].includes(item.squadStatus),
  );
  const historyItems = items.filter(
    (item) =>
      item.membershipStatus !== "ACTIVE" ||
      ["MISSION_COMPLETED", "DISBANDED"].includes(item.squadStatus),
  );

  return (
    <div className="nexus-app-page flex min-h-screen w-full min-w-0 flex-col overflow-x-clip bg-slate-50">
      <Navbar displayName={profile.nama_lengkap} avatarPath={profile.foto_profil_path} activeItem="my-squad" />
      <main className="nexus-page-shell my-squad-page relative flex w-full min-w-0 flex-1 justify-center overflow-x-clip px-4 py-7 text-slate-900 sm:px-6 sm:py-10 lg:py-14">
        <div
          aria-hidden="true"
          className="absolute -left-32 -top-32 h-80 w-80 rounded-full bg-indigo-200/50 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-40 -right-32 h-96 w-96 rounded-full bg-violet-200/50 blur-3xl"
        />

        <section className="relative w-full min-w-0 max-w-6xl">
          <p className="text-sm font-bold tracking-[0.2em] text-indigo-600">
            KOLABORASI
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:mt-3 sm:text-4xl">
            My Squad
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
            Lihat Squad aktif dan riwayat kolaborasimu dari seluruh Mission.
          </p>

          <section className="mt-8" aria-labelledby="active-squads-title">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2
                  id="active-squads-title"
                  className="text-xl font-bold text-slate-950 sm:text-2xl"
                >
                  Squad Aktif
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {activeItems.length} Squad aktif
                </p>
              </div>
            </div>

            {activeItems.length === 0 ? (
              <div className="mt-4">
                <EmptyState description="Kamu belum memiliki Squad aktif. Temukan Mission dan bergabung dengan Squad yang sesuai." />
              </div>
            ) : (
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                {activeItems.map((item) => (
                  <SquadCard
                    key={item.membershipId}
                    item={item}
                    variant="active"
                    historyDetailsLoadFailed={historyDetailsLoadFailed}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="mt-10" aria-labelledby="squad-history-title">
            <div>
              <h2
                id="squad-history-title"
                className="text-xl font-bold text-slate-950 sm:text-2xl"
              >
                Riwayat Squad
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {historyItems.length} riwayat keanggotaan
              </p>
            </div>

            {historyItems.length === 0 ? (
              <div className="mt-4">
                <EmptyState description="Belum ada riwayat Squad yang selesai, ditinggalkan, atau berakhir." />
              </div>
            ) : (
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                {historyItems.map((item) => (
                  <SquadCard
                    key={item.membershipId}
                    item={item}
                    variant="history"
                    historyDetailsLoadFailed={historyDetailsLoadFailed}
                  />
                ))}
              </div>
            )}
          </section>
        </section>
      </main>
    </div>
  );
}
