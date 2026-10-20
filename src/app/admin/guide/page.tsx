import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";

const guides = [
  { href: "/admin/missions", title: "Pengajuan Mission", steps: [
    "Buka pengajuan dan cocokkan informasi lomba, tautan resmi, deadline, serta dokumen pendukung.",
    "Untuk menyetujui, pilih tier final dan periksa batas minimum–maksimum anggota tim.",
    "Klik Setujui setelah informasi lengkap. Persetujuan menerbitkan Mission; tidak memberikan XP.",
    "Jika perlu perbaikan, isi alasan yang jelas lalu klik Tolak. Mahasiswa dapat memperbaiki dan mengirim ulang.",
  ] },
  { href: "/admin/results", title: "Hasil Mission", steps: [
    "Buka pengajuan Squad dan periksa sertifikat serta dokumen pendukung yang tersedia.",
    "Cocokkan kompetisi, tier, hasil akhir, dan preview XP pada formulir keputusan.",
    "Setujui dan konfirmasi jika bukti sesuai. Sistem membagikan XP kepada anggota yang memenuhi ketentuan, menyelesaikan Mission Squad, dan menghapus chat Squad.",
    "Jika bukti perlu diperbaiki, isi alasan lalu tolak. Ketua dapat memperbaiki dan mengirim ulang hasil.",
  ] },
  { href: "/admin/achievements", title: "Klaim Prestasi", steps: [
    "Buka klaim mahasiswa dan cocokkan identitas, nama kompetisi, hasil, serta sertifikat.",
    "Pilih tier yang sesuai dan periksa Legacy XP final yang dihitung sistem.",
    "Klik Setujui dan konfirmasi untuk mencatat prestasi serta memberikan Legacy XP.",
    "Jika klaim perlu diperbaiki, tulis alasannya lalu klik Tolak. Mahasiswa dapat memperbaiki dan mengirim ulang.",
  ] },
];

export default async function AdminGuidePage() {
  await requireAdmin();
  return <main className="nexus-admin-guide">
    <p className="nexus-eyebrow">PANDUAN PENGGUNAAN</p>
    <h1>Panduan Admin</h1>
    <p className="nexus-admin-guide-lead">Periksa bukti terlebih dahulu, lalu berikan keputusan pada jenis pengajuan yang sesuai.</p>
    {guides.map(({ href, title, steps }) => <section key={href} className="nexus-admin-guide-section">
      <h2>{title}</h2>
      <ol>{steps.map((step) => <li key={step}>{step}</li>)}</ol>
      <Link href={href}>Buka antrean {title.toLowerCase()} →</Link>
    </section>)}
    <section className="nexus-admin-guide-section">
      <h2>Saat koneksi atau bukti bermasalah</h2>
      <ul>
        <li>Jika dokumen tidak terbuka, muat ulang halaman untuk mendapatkan tautan baru. Jangan setujui sebelum bukti dapat diperiksa.</li>
        <li>Jika penyimpanan keputusan gagal, muat ulang dan periksa status sebelum mencoba lagi.</li>
        <li>Pengajuan yang sudah diputuskan keluar dari antrean PENDING. Tautan detail yang sudah disimpan tetap dapat menunjukkan status akhirnya.</li>
        <li>Gunakan tombol Keluar setelah selesai, terutama pada perangkat bersama.</li>
      </ul>
    </section>
  </main>;
}
