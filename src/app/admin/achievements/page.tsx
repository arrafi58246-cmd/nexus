import Link from "next/link";

import { requireAdmin } from "@/lib/auth/admin";

export default async function AdminAchievementsPage() {
  const { supabase } = await requireAdmin();

  const { data: pending, error } = await supabase.from("achievement_claims")
    .select("achievement_claim_id, nama_kompetisi, user_id, submitted_at")
    .eq("status_validation", "PENDING")
    .order("submitted_at", { ascending: true }).limit(50);
  const ids = [...new Set((pending ?? []).map((claim) => claim.user_id))];
  const profilesQuery = ids.length
    ? await supabase.from("profiles").select("user_id, nama_lengkap").in("user_id", ids)
    : { data: [], error: null };
  const names = new Map((profilesQuery.data ?? [])
    .map((profile) => [profile.user_id, profile.nama_lengkap]));

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-bold">Review Klaim Prestasi</h1>
        <p className="mt-2 text-sm text-slate-600">Menampilkan maksimal 50 klaim tertua yang menunggu review.</p>
        {error || profilesQuery.error ? (
          <p role="alert" className="mt-5 text-red-700">Daftar klaim belum dapat dimuat.</p>
        ) : pending?.length ? (
          <ul className="mt-5 space-y-3">
            {pending.map((claim) => (
              <li key={claim.achievement_claim_id}
                className="rounded-xl border border-slate-200 bg-white p-4">
                <Link href={`/admin/achievements/${claim.achievement_claim_id}`}
                  className="font-semibold text-indigo-700 underline">{claim.nama_kompetisi}</Link>
                <p className="mt-1 text-sm text-slate-600">
                  {names.get(claim.user_id) ?? "Mahasiswa"} · {new Date(claim.submitted_at)
                    .toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB
                </p>
              </li>
            ))}
          </ul>
        ) : <p className="mt-5 text-sm text-slate-600">Belum ada klaim yang menunggu review.</p>}
      </main>
    </div>
  );
}

