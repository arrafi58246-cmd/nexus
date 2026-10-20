import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import Navbar from "@/components/layout/Navbar";
import BadgePill from "@/components/profile/BadgePill";
import { RANK_ICONS, describeBadge, one, rankTierFromName } from "@/lib/badges";
import { createClient } from "@/lib/supabase/server";

import EquipBadgeButton from "./EquipBadgeButton";

function BadgeError({ message }: { message: string }) {
  return <p role="alert" className="mt-6 rounded-xl bg-white p-5 text-red-700">{message}</p>;
}

const GROUPS = [
  { key: "UNIVERSITAS", title: "Universitas (se-UNESA)" },
  { key: "FAKULTAS", title: "Fakultas" },
  { key: "PROGRAM_STUDI", title: "Program Studi" },
  { key: "RANK", title: "Rank-Up" },
] as const;

export default async function BadgeChestPage() {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) redirect("/login");

  const { data: profile, error: profileError } = await supabase.from("profiles")
    .select("nama_lengkap, role_app, status_akun, primary_class_id, foto_profil_path")
    .eq("user_id", auth.user.id).maybeSingle();
  if (!profileError && profile?.role_app === "ADMIN") redirect("/admin");
  if (!profileError && profile?.role_app === "STUDENT" && profile.primary_class_id === null) {
    redirect("/onboarding");
  }

  const canView = !profileError && profile?.role_app === "STUDENT" &&
    profile.status_akun === "ACTIVE";
  const badges = canView
    ? await supabase.from("user_badges")
        .select(`user_badge_id, reward_context, scope_type, rank_position, population_total,
          is_equipped, awarded_at,
          badge_definitions(badge_name, badge_type, description),
          seasons(nama_season), program_studi(nama_program_studi), fakultas(nama_fakultas)`)
        .eq("user_id", auth.user.id)
        .order("awarded_at", { ascending: false })
    : { data: null, error: null };

  const rows = (badges.data ?? []).map((row) => {
    const definition = one(row.badge_definitions);
    const season = one(row.seasons);
    const program = one(row.program_studi);
    const faculty = one(row.fakultas);
    const view = describeBadge({
      badgeName: definition?.badge_name ?? null,
      scopeType: row.scope_type,
      scopeName: row.scope_type === "FAKULTAS" ? faculty?.nama_fakultas ?? null
        : row.scope_type === "PROGRAM_STUDI" ? program?.nama_program_studi ?? null : null,
      rankPosition: row.rank_position,
      populationTotal: row.population_total,
    });
    return { row, definition, season, view,
      group: view?.scope ?? "RANK" };
  });

  return (
    <div className="nexus-app-page min-h-screen bg-slate-50 text-slate-900">
      {profile && <Navbar displayName={profile.nama_lengkap} avatarPath={profile.foto_profil_path} activeItem="profile" />}
      <main className="nexus-page-shell mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <Link href="/profile" className="text-sm font-semibold text-indigo-700 hover:underline">
          ← Profil Saya
        </Link>
        <h1 className="mt-5 text-2xl font-bold">Badge Chest</h1>
        <p className="mt-2 text-sm text-slate-600">
          Koleksi Badge yang telah kamu peroleh, termasuk Season sebelumnya. Pilih satu Badge
          untuk dipasang di profil; warna border foto profil ikut berubah mengikuti Badge yang terpasang.
        </p>
        <div className="chest-legend" aria-label="Arti warna Badge">
          <BadgePill scope="UNIVERSITAS" size="sm">Universitas</BadgePill>
          <BadgePill scope="FAKULTAS" size="sm">Fakultas</BadgePill>
          <BadgePill scope="PROGRAM_STUDI" size="sm">Program Studi</BadgePill>
          <small>Emas: se-UNESA · Biru: fakultas · Hijau: program studi</small>
        </div>

        {!canView ? (
          <BadgeError message="Koleksi Badge belum dapat dibuka dari akun ini." />
        ) : badges.error ? (
          <BadgeError message="Koleksi Badge belum dapat dimuat. Coba muat ulang." />
        ) : !rows.length ? (
          <p className="mt-6 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
            Belum ada Badge. Badge yang diberikan dari Rank-Up atau Leaderboard akan muncul di sini.
          </p>
        ) : GROUPS.map((group) => {
          const items = rows.filter((item) => item.group === group.key);
          if (!items.length) return null;
          return (
            <section key={group.key} className="chest-group" aria-label={group.title}>
              <h2>{group.title}</h2>
              <ul className="chest-grid">
                {items.map(({ row, definition, season, view }) => {
                  const context = row.reward_context === "CAREER"
                    ? "Career Rank-Up"
                    : row.reward_context === "SEASONAL" ? "Seasonal Rank-Up" : "Leaderboard";
                  const tier = view?.tier ?? rankTierFromName(definition?.badge_name);
                  return (
                    <li key={row.user_badge_id}
                      className={`chest-card${row.is_equipped ? " chest-card--equipped" : ""}`}>
                      <div className="chest-card-top">
                        {view?.scope ? (
                          <BadgePill scope={view.scope} detail={view.detail}>{view.label}</BadgePill>
                        ) : (
                          <div className="chest-tier">
                            {tier && <Image src={RANK_ICONS[tier]} alt="" width={52} height={52} />}
                            <strong>{definition?.badge_name ?? "Badge"}</strong>
                          </div>
                        )}
                        {row.is_equipped && <span className="chest-equipped">Terpasang</span>}
                      </div>
                      {definition?.description && <p className="chest-desc">{definition.description}</p>}
                      <dl className="chest-facts">
                        <div><dt>Jenis: </dt>
                          <dd>{definition?.badge_type === "RANK_UP" ? "Rank-Up" : `Posisi Leaderboard · ${definition?.badge_name ?? "Badge"}`}</dd></div>
                        <div><dt>Konteks: </dt><dd>{context}</dd></div>
                        {season && <div><dt>Season: </dt><dd>{season.nama_season}</dd></div>}
                        {row.rank_position !== null && row.population_total !== null && (
                          <div><dt>Posisi: </dt>
                            <dd>#{row.rank_position} dari {row.population_total.toLocaleString("id-ID")}</dd></div>
                        )}
                        <div><dt>Diperoleh: </dt>
                          <dd>{new Intl.DateTimeFormat("id-ID", {
                            dateStyle: "medium", timeZone: "Asia/Jakarta",
                          }).format(new Date(row.awarded_at))}</dd></div>
                      </dl>
                      {!row.is_equipped && <EquipBadgeButton userBadgeId={row.user_badge_id} />}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </main>
    </div>
  );
}
