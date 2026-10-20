import Link from "next/link";

import { requireAdmin } from "@/lib/auth/admin";

export default async function AdminResultsPage() {
  const { supabase } = await requireAdmin();

  const { data: pending, error } = await supabase.from("mission_result_submissions")
    .select("result_submission_id, squad_id, hasil_kompetisi, submitted_at")
    .eq("status_validation", "PENDING")
    .order("submitted_at", { ascending: true }).limit(50);

  const squadIds = [...new Set((pending ?? []).map((row) => row.squad_id))];
  const squadQuery = squadIds.length
    ? await supabase.from("squads").select("squad_id, mission_id, nama_squad")
        .in("squad_id", squadIds)
    : { data: [], error: null };
  const squads = squadQuery.data ?? [];
  const missionIds = [...new Set(squads.map((squad) => squad.mission_id))];
  const missionQuery = missionIds.length
    ? await supabase.from("missions").select("mission_id, nama_lomba")
        .in("mission_id", missionIds)
    : { data: [], error: null };

  const squadById = new Map(squads.map((squad) => [squad.squad_id, squad]));
  const missionById = new Map((missionQuery.data ?? [])
    .map((mission) => [mission.mission_id, mission.nama_lomba]));
  const failed = error || squadQuery.error || missionQuery.error;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-bold">Review Hasil Mission</h1>
        <p className="mt-2 text-sm text-slate-600">
          Pengajuan menunggu verifikasi. Daftar menampilkan maksimal 50 yang paling lama.
        </p>
        {failed ? (
          <p role="alert" className="mt-6 text-red-700">Daftar belum dapat dimuat. Coba lagi.</p>
        ) : pending?.length ? (
          <ul className="mt-6 space-y-3">
            {pending.map((item) => {
              const squad = squadById.get(item.squad_id);
              return (
                <li key={item.result_submission_id}
                  className="rounded-2xl border border-slate-200 bg-white p-5">
                  <p className="font-bold">{squad?.nama_squad ?? "Squad"}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {squad ? missionById.get(squad.mission_id) ?? "Mission" : "Mission"}
                    {" · "}{item.hasil_kompetisi.replaceAll("_", " ")}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Dikirim {new Date(item.submitted_at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB
                  </p>
                  <Link href={`/admin/results/${item.result_submission_id}`}
                    className="mt-4 inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white">
                    Periksa bukti
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-6 rounded-xl bg-white p-5 text-sm text-slate-600">
            Belum ada hasil Mission yang menunggu review.
          </p>
        )}
      </main>
    </div>
  );
}

