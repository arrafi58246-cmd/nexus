import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";

export default async function AdminDashboardPage() {
  const { supabase } = await requireAdmin();
  const [missions, results, achievements] = await Promise.all([
    supabase.from("mission_submissions").select("mission_submission_id", { count: "exact", head: true })
      .eq("status_review", "PENDING"),
    supabase.from("mission_result_submissions").select("result_submission_id", { count: "exact", head: true })
      .eq("status_validation", "PENDING"),
    supabase.from("achievement_claims").select("achievement_claim_id", { count: "exact", head: true })
      .eq("status_validation", "PENDING"),
  ]);
  const queues = [
    { href: "/admin/missions", title: "Pengajuan Mission", response: missions,
      description: "Periksa informasi lomba, dokumen, dan tentukan tier sebelum Mission ditayangkan." },
    { href: "/admin/results", title: "Hasil Mission", response: results,
      description: "Verifikasi bukti dan hasil kompetisi Squad sebelum XP diberikan." },
    { href: "/admin/achievements", title: "Klaim Prestasi", response: achievements,
      description: "Periksa sertifikat prestasi mahasiswa dan tier untuk pemberian Legacy XP." },
  ];
  const failed = queues.some(({ response }) => response.error || response.count === null);
  const total = failed ? null : queues.reduce((sum, { response }) => sum + (response.count ?? 0), 0);

  return <main className="nexus-admin-dashboard">
    <section className="nexus-admin-hero">
      <div>
        <p className="nexus-eyebrow">PUSAT VERIFIKASI</p>
        <h1>Ringkasan Admin</h1>
        <p>Mulai dari pengajuan yang menunggu keputusanmu.</p>
      </div>
      <div className="nexus-admin-total">
        <span>Total menunggu review</span>
        <strong>{total === null ? "—" : total.toLocaleString("id-ID")}</strong>
        <span>{total === 0 ? "Semua antrean sudah ditinjau" : "Pada tiga jenis pengajuan"}</span>
      </div>
    </section>
    {failed && <p role="alert" className="nexus-admin-alert">
      Sebagian jumlah antrean belum dapat dimuat. Muat ulang halaman atau buka daftar review.
    </p>}
    <section className="nexus-admin-queues" aria-label="Antrean review">
      {queues.map(({ href, title, description, response }, index) => {
        const unavailable = Boolean(response.error) || response.count === null;
        return <article key={href} className="nexus-admin-queue">
          <div className="nexus-admin-queue-heading">
            <span className="nexus-admin-queue-number" aria-hidden="true">0{index + 1}</span>
            <span>{unavailable ? "Belum tersedia" : response.count === 0 ? "Tidak ada antrean" : "Menunggu review"}</span>
          </div>
          <p className="nexus-admin-queue-count">{unavailable ? "—" : response.count?.toLocaleString("id-ID")}</p>
          <h2>{title}</h2>
          <p className="nexus-admin-queue-description">{description}</p>
          <Link href={href}>Buka {title.toLowerCase()} <span aria-hidden="true">→</span></Link>
        </article>;
      })}
    </section>
    <section className="nexus-admin-help">
      <div><h2>Baru mulai melakukan review?</h2>
        <p>Ikuti panduan pemeriksaan bukti dan pemberian keputusan.</p></div>
      <Link href="/admin/guide">Buka panduan admin →</Link>
    </section>
    <p className="nexus-admin-footnote">Jumlah diperbarui saat halaman dibuka kembali atau dimuat ulang.
      Daftar review menampilkan maksimal 50 pengajuan tertua per jenis.</p>
  </main>;
}
