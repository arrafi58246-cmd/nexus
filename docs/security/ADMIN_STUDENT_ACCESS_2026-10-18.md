# Pemisahan akses admin dan mahasiswa — 18 Oktober 2026

ADMIN menggunakan `/admin`: ringkasan, review Mission, review hasil, review klaim
prestasi, panduan, dan logout. Identitas admin bukan tautan ke profil mahasiswa;
sidebar tidak lagi menautkan Discovery. Navbar fallback ADMIN hanya menautkan panel.

Delapan belas halaman mahasiswa memeriksa role profil sesi di server dan mengalihkan
ADMIN ke `/admin`, sebelum onboarding, data mahasiswa, atau formulir partisipasi.
Termasuk Mission/detail/Add Mission/pengajuan, leaderboard, My Squad/Room/hasil/
endorsement, profil/subhalamannya, notifikasi, onboarding. Login dan Home sudah
mengarahkan ADMIN ke panel pada rilis sebelumnya.

Join Squad memeriksa STUDENT ACTIVE dan onboarding di server action serta endpoint
JSON (403 untuk admin). Create Squad, onboarding, edit profil, dan upload avatar
juga menolak aksi mahasiswa dari admin.

Migration `20261018072821_restrict_squad_participation_to_students.sql` diterapkan
ke database hosted: RPC submit/create dan trigger insert hanya menerima mahasiswa
aktif; penerimaan pelamar memeriksa STUDENT; guard membership mencegah admin menjadi
anggota melalui penulisan langsung. Urutan lock, kapasitas, deadline, transisi status,
dan history existing dipertahankan. Migration dibuat melalui CLI; nama file
diselaraskan dengan versi yang dicatat server `apply_migration`.

Tidak menambah Admin Intervention, pengelolaan akun, perubahan XP, atau akses chat.

## Bukti

- Lint, build/TypeScript, audit production dependency, dan 84 tes aplikasi PASS lokal.
- Tes role menjalankan 18 halaman dengan ADMIN tanpa onboarding dan membuktikan
  redirect sebelum query data mahasiswa. STUDENT tetap melewati guard tersebut.
- API/Action Join: ADMIN/missing profile/suspended/belum onboarding ditolak tanpa
  RPC; Auth/profile gagal tidak menulis; STUDENT eligible berhasil. Create Squad
  dan onboarding ADMIN ditolak sebelum penulisan.
- HTTP/SSR production build dengan Auth/Data API sintetis lokal: 18 redirect admin,
  lima halaman panel dengan tautan admin saja, Join admin 403 tanpa RPC, serta
  Discovery/My Squad dan Join 201 untuk mahasiswa PASS. Origin API mengikuti
  origin internal localhost pada server pengujian Next.
- `supabase/tests/student_squad_roles.sql` dijalankan pada database hosted sebagai
  role `authenticated`: admin submit/create RPC, insert application/membership/
  Squad langsung ditolak, termasuk metadata palsu STUDENT. Pengajuan admin lama
  tidak bisa diterima ketua. Mahasiswa create/apply/accept berhasil dan duplikasi
  tetap ditolak. Semua fixture dan penulisan jalur positif di-ROLLBACK.
- Advisor keamanan sesudah migration sama dengan sebelum: dua view definer,
  18 RPC definer authenticated existing, serta leaked-password protection disabled.
  Tidak ada advisory baru; ini bukan klaim audit keamanan penuh.
- Browser login admin produksi setelah perubahan ini belum dijalankan agent;
  screenshot owner membuktikan bug dan panel admin sebelumnya. CI/deployment
  dicatat pada PR perbaikan.

## Data pengajuan lama

Satu aplikasi ADMIN masih PENDING, tanpa membership ADMIN. Pembatalan diblokir
automatic approval review karena dianggap perubahan data produksi di luar perbaikan
akses; tidak dicoba ulang. Pengajuan tetap tersimpan dan guard baru menolak acceptance.
Pembatalan memerlukan persetujuan khusus owner.
