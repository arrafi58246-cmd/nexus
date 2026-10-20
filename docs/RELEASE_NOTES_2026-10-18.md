# NEXUS — catatan rilis 18 Oktober 2026

## Aplikasi dan baseline

- Produksi: https://nexus-unesa.vercel.app.
- Repository: `ReiKatsu/Nexus`; branch produksi `main` pada project Vercel `nexus`.
- Baseline sebelum panel admin: `6d667f11c5a1bf55b22bd41389cb8dd9e1ae89fe` (#55).
- Vercel Functions dan Supabase berada di Singapore (`sin1` / `ap-southeast-1`).
- Domain baru aktif; owner melaporkan Site URL Supabase Auth telah diperbarui.

## Perubahan pada rilis ini

Panel `/admin` menyediakan jumlah PENDING untuk pengajuan Mission, hasil Mission,
dan klaim prestasi. Ketiganya memakai data sesi admin dan RLS existing. Jumlah
mencakup seluruh antrean, sedangkan daftar existing menampilkan maksimal 50
pengajuan tertua. Query gagal ditampilkan sebagai tidak tersedia, bukan nol.

Dashboard, tiga daftar, detail review, dan `/admin/guide` memakai navigasi admin
khusus. Login dan Home akun ADMIN ACTIVE menuju dashboard. Tiap halaman tetap
memeriksa hak akses di server; pengecekan tidak bergantung pada layout saja.
Keputusan review memperbarui dashboard. Panduan admin tersedia di dalam aplikasi.

Ini perubahan antarmuka dan pembacaan data; schema, RLS, aturan XP, serta RPC
persetujuan tidak diubah. Laporan masalah Squad/Admin Intervention tetap ditunda.

## Bukti dan batas pengujian

- Owner, 18 Oktober: chat tanpa restart/refresh dan mobile dilaporkan aman;
  pengujian pengguna yang telah dilakukan diterima untuk prototipe saat ini.
- Upload diterima oleh owner untuk uji coba; bukan klaim seluruh kasus batas
  upload dan keamanan telah diuji ulang.
- Kandidat panel admin: lint, build/TypeScript, dan 78 tes aplikasi PASS lokal.
  Enam tes baru mencakup guard role/status, akses langsung halaman, jumlah antrean,
  error parsial, dan menu aktif. Login/Home regression diarahkan ke `/admin`.
- Query read-only dengan role `authenticated` dan konteks ADMIN ACTIVE di database
  hosted berhasil membaca tiga jumlah PENDING (semuanya nol saat pemeriksaan).
- HTTP/SSR production build diperiksa memakai Auth/data sintetis lokal: lima route
  admin, count/error, penolakan STUDENT, dan redirect anonim. Pemeriksaan browser
  visual/hydration belum lulus karena browser lokal tidak tersedia dan browser
  cloud tidak mengizinkan file preview. Ini bukan pengujian ulang approval nyata
  dengan akun produksi. Hasil CI/deployment kandidat dicatat pada PR.
- Bukti reconnect setelah koneksi sengaja diputus, beberapa concurrency ekstrem,
  serta pemulihan backup lengkap belum dinyatakan PASS.

## Deploy dan pemulihan versi aplikasi

1. Buat PR dari branch fitur ke `main`, periksa diff, lint, test, audit production,
   build, dan hasil preview Vercel pada commit yang sama.
2. Setelah pemeriksaan lulus, merge PR; integrasi Git Vercel membangun produksi.
   Pastikan deployment READY, commit sesuai, dan domain produksi menunjuk ke versi itu.
3. Periksa halaman publik dan batas akses anonim; login ADMIN menuju `/admin`,
   menu review/panduan, serta alur mahasiswa tetap tersedia.
4. Bila perubahan antarmuka bermasalah, gunakan rollback deployment produksi
   sebelumnya di Vercel. Baseline sebelum panel: deployment
   `dpl_DEVpSwcGT33yqqMruRN6SgxAh5kG` pada commit #55 di atas.
   Setelah rollback, periksa domain dan status auto-assignment sebelum rilis berikutnya.

Rollback aplikasi tidak memulihkan database atau file upload. Perubahan ini tidak
membutuhkan rollback schema. Jangan mengembalikan database produksi hanya untuk
menguji backup. Lihat [panduan backup](BACKUP_AND_RECOVERY.md).

## Pekerjaan operasional tersisa

Verifikasi backup database **dan** file Storage melalui pemulihan terisolasi.
Dokumentasi prosedur belum menjadi bukti bahwa salinan cadangan sudah dibuat atau
bisa dipulihkan. Hasil browser produksi panel admin dicatat setelah digunakan owner.
