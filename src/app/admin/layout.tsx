import Image from "next/image";
import Link from "next/link";
import AdminNavigation from "@/components/admin/AdminNavigation";
import LogoutButton from "@/components/layout/LogoutButton";
import { requireAdmin } from "@/lib/auth/admin";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { supabase, admin } = await requireAdmin();
  const avatarUrl = admin.foto_profil_path
    ? supabase.storage.from("avatars").getPublicUrl(admin.foto_profil_path).data.publicUrl : null;

  return <div className="nexus-admin">
    <a className="nexus-admin-skip" href="#admin-content">Lewati ke konten</a>
    <header className="nexus-admin-header">
      <Link href="/admin" className="nexus-admin-brand" aria-label="NEXUS Panel Admin">
        <Image src="/nexus-logo.svg" alt="" width={36} height={36} />
        <span>NEXUS<small>Panel Admin</small></span>
      </Link>
      <div className="nexus-admin-account">
        <div className="nexus-admin-identity">
          {avatarUrl && <Image src={avatarUrl} alt="" width={36} height={36} unoptimized />}
          <span>{admin.nama_lengkap}<small>Administrator</small></span>
        </div>
        <LogoutButton />
      </div>
    </header>
    <div className="nexus-admin-workspace">
      <aside className="nexus-admin-sidebar">
        <p className="nexus-eyebrow">RUANG KERJA</p>
        <AdminNavigation />
        <div className="nexus-admin-sidebar-footer">
          <p>Kelola pengajuan dan verifikasi pencapaian mahasiswa.</p>
        </div>
      </aside>
      <div id="admin-content" className="nexus-admin-content" tabIndex={-1}>{children}</div>
    </div>
  </div>;
}
