# NEXUS — persiapan Vercel Hobby, 15 Oktober 2026

Owner memilih Vercel Hobby gratis untuk prototype. Tetap gunakan project Supabase
existing; tidak membuat database, bucket, domain berbayar, atau langganan baru.
Belum ada deployment yang dibuat dalam pekerjaan ini: koneksi mengenali akun
Hobby owner, tetapi akses workspace `fyodor-s-projects1` ditolak HTTP 403.
CLI Vercel tidak tersedia sebagai fallback. Daftar kosong tanpa scope bukan bukti
bahwa workspace tersebut tidak memiliki project.

## Perubahan upload

Batas request/response Vercel Function adalah 4,5 MB, sedangkan batas produk
existing lebih besar. Keempat form memakai `submitWithUploads`: browser upload
ke Supabase dengan sesi sendiri dan `upsert:false`, lalu mengirim FormData berisi
path dan teks ke endpoint existing. Server membaca ulang byte melalui sesi/RLS
caller dan menjalankan validator MIME/signature/ukuran existing sebelum menyimpan.
Path wajib berada pada folder pemilik dan entitas terkait dengan nama UUID valid.
Kirim ulang memakai ID pengajuan lama dan file baru; path bukti sebelumnya ditolak.

Tidak ada perubahan schema/RLS/visibility bucket, reward, atau batas file:
avatar 5.242.880 byte, Mission 10.485.760 byte, sertifikat 5.000.000 byte per file.
Multipart File lama masih diterima handler, tetapi tunduk pada batas request host;
frontend deploy harus memakai helper. Dua berkas hasil Squad tidak digabung dalam
request Vercel. Tidak ada service-role/secret baru.

Upload kedua yang gagal membersihkan file pertama sebelum request aplikasi.
HTTP 4xx membersihkan unggahan baru melalui RLS existing. Jika jaringan/5xx gagal
setelah request aplikasi, file dipertahankan karena write mungkin sudah commit.
Ini dapat meninggalkan file tanpa referensi; cleanup massal otomatis tidak ditambah.
Validasi server mengunduh file sekali lagi, sehingga menggunakan egress Supabase.
Pengujian Storage dan browser hosted pada alur baru masih perlu dilakukan.

## Import ketika akses owner tersedia

1. Buka https://vercel.com/new memakai akun owner dan workspace Hobby yang benar.
   Import `ReiKatsu/Nexus`; jika repo tidak terlihat, berikan instalasi GitHub
   Vercel akses ke repo ini saja. Jangan mengganti visibility repo.
2. Framework Next.js, Root Directory root repo (`./`), Node.js 22.x,
   Install Command `npm ci`, Build Command `npm run build`, Output Directory default.
3. Masukkan dua Config environment berikut ke **Production** sebelum build:

   | Nama | Nilai/sumber |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://nqgwjftcxjzykfshhbgt.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → Settings → API Keys → Publishable key |

   Jangan isi `NEXUS_QA_ENVIRONMENT=testing` untuk database produksi. Jangan
   menaruh service-role, password akun, atau kredensial SMTP di `NEXT_PUBLIC_*`.
   Preview tidak otomatis diberi akses produksi; tetapkan scope per environment.
4. Periksa commit `main` yang lolos CI sebelum menekan Deploy. Build harus Ready;
   periksa Build Logs/Runtime Logs tanpa menyalin token atau data pribadi ke laporan.
   Catat URL `.vercel.app` yang benar-benar diberikan Vercel.
5. Supabase → Authentication → URL Configuration: Site URL diisi origin produksi
   persis tersebut. Periksa Redirect URLs yang memang dipakai; jangan menambah
   wildcard preview luas. Uji konfirmasi email sebelum membuka registrasi umum.

Repo ini private. Pada Hobby, commit yang dideploy harus dikenali sebagai milik
owner workspace melalui koneksi GitHub Vercel. Kolaborator tetap mengajukan PR;
owner meninjau/menggabungkan kandidat. Jika deployment ditolak karena atribusi,
periksa Login Connections dan commit yang ditolak, tanpa memalsukan author.

SMTP bawaan Supabase hanya mengirim ke alamat anggota organisasi yang diizinkan.
Untuk registrasi mahasiswa umum, konfigurasi custom SMTP di Authentication → SMTP
Settings dan uji pengiriman/konfirmasi. Akun demo yang telah dikonfirmasi dapat
dipakai untuk demo terbatas; jangan menganggap registrasi publik sudah teruji.

## Bukti dan hal yang tersisa

- Pemeriksaan kode lokal: suite 72 tes, lint, production build/TypeScript dan audit
  dependency produksi PASS (0 vulnerability pada audit produksi).
- Tes sintetis menjalankan helper browser → mock Storage → empat handler asli:
  file besar menghasilkan request metadata <10 KB dan tersimpan sekali; dua
  sertifikat 5 MB, signature palsu, folder asing, caller SUSPENDED/non-Ketua,
  partial upload, retry REJECTED dan cleanup/ketidakpastian jaringan tercakup.
- Katalog policy Storage live dibaca: ownership/ACTIVE serta perlindungan bukti
  privat yang direferensikan tetap ada. Tidak ada write atau migrasi database.
- Belum PASS: build Vercel nyata, environment hosting, Auth URL/SMTP, browser upload
  hosted, Realtime/reconnect dua akun, mobile, backup dan prosedur restore.
- Rollback kode melalui kandidat sebelumnya; tidak ada schema rollback. Periksa
  referensi sebelum menghapus file; jangan membersihkan Storage secara massal.

Referensi: [batas Function](https://vercel.com/docs/functions/limitations),
[kolaborasi Hobby](https://vercel.com/docs/deployments/troubleshoot-project-collaboration),
[SMTP Supabase](https://supabase.com/docs/guides/auth/auth-smtp).
