# NEXUS — backup dan pemulihan

Status 18 Oktober 2026: **backup file Storage dan pemeriksaan integritas lokal
selesai; backup/pemulihan database lengkap belum diverifikasi**. Project memakai
paket Free, dikonfirmasi lewat metadata organisasi. Akun aplikasi ADMIN berbeda
dari akses operator Supabase. Tidak ada perubahan data produksi, restore hosted,
atau perubahan paket. [Bukti dan batas pemeriksaan](BACKUP_CHECK_2026-10-18.md).

## Data yang perlu dicadangkan

| Sumber | Isi | Catatan |
| --- | --- | --- |
| GitHub | Code, konfigurasi nonrahasia, migration | Tidak menyimpan data database dan file pengguna |
| Database Supabase | Data aplikasi, relasi, aturan akses, serta cakupan Auth sesuai metode backup | Periksa apa yang benar-benar tercakup pada backup/export yang dipilih |
| Supabase Storage | Avatar, dokumen lomba, sertifikat hasil, sertifikat prestasi | Backup database hanya memuat metadata Storage, bukan isi file |
| Konfigurasi layanan | Domain, Auth redirect, bucket/access settings, daftar env yang diperlukan | Rahasia disimpan di tempat terbatas; jangan dimasukkan ke repo atau laporan |

## Prosedur operator

1. Periksa menu Database → Backups dan metode backup yang tersedia pada paket
   Supabase project existing. Jika mengandalkan export CLI, ikuti dokumentasi
   `db dump` terbaru dan periksa cakupan schema, data, serta roles/Auth.
2. Catat waktu backup, metode, cakupan, lokasi penyimpanan terbatas, dan pemeriksa.
   Simpan cadangan di luar project asal. Jangan commit dump database ke GitHub.
3. Salin isi bucket Storage melalui akses operator yang sah; pertahankan nama
   bucket dan path object agar referensi database cocok. Cadangkan metadata yang
   diperlukan sesuai metode yang dipilih.
4. Pulihkan ke lingkungan terpisah yang memang disiapkan untuk latihan. Pastikan
   koneksi menunjuk ke tujuan uji, dan pengiriman email/job terjadwal tidak
   memengaruhi pengguna produksi. Jangan memakai tombol restore produksi untuk latihan.
5. Periksa tabel/relasi dan jumlah data penting; sampling Mission, Squad, profil,
   ledger XP, status pengajuan, serta file yang dirujuk. Cocokkan hasil dengan
   inventaris dari waktu backup, bukan kondisi produksi yang sudah berubah.
6. Uji akses login, role/RLS, dan pembacaan bukti pada hasil pemulihan sesuai
   cakupan metode backup. Pastikan file yang dirujuk benar-benar dapat dibuka.
7. Catat expected/actual, kendala, dan lokasi bukti. Hanya tandai PASS jika salinan
   dapat dipulihkan dan cakupan database/file/konfigurasi telah dinyatakan jelas.

## Catatan verifikasi

| Pemeriksaan | Status |
| --- | --- |
| Paket dan metode database | Free terkonfirmasi; export manual CLI diperlukan |
| Salinan database tersedia dan dapat dibaca | Belum; akses export tidak tersedia di sesi ini |
| Salinan file Storage | 6/6 avatar terunduh, metadata sumber tetap, ukuran/SHA-256 cocok |
| Integritas arsip dan ekstraksi lokal | PASS: CRC ZIP dan SHA-256 semua file setelah ekstraksi |
| Restore ke Supabase/aplikasi terpisah | Belum |
| Login, role/RLS, dan data database setelah restore | Belum |

Rujukan operator: [Supabase Backups](https://supabase.com/docs/guides/platform/backups),
[Supabase CLI db dump](https://supabase.com/docs/reference/cli/supabase-db-dump).


## Langkah yang memerlukan operator

Lingkungan sesi pemeriksaan tidak memiliki CLI Supabase/Postgres/Docker,
connection string database atau kredensial operator, dan belum ada branch uji.
Koneksi SQL yang tersedia bukan antarmuka untuk mengunduh backup penuh. Karena
itu, tidak ada klaim bahwa backup database sudah dibuat. Tidak perlu membeli
paket atau membuat branch berbayar hanya untuk menutup laporan ini.

Operator dapat memakai laptop dengan Supabase CLI dan Docker Desktop sesuai
[panduan export resmi](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore).
Masukkan kredensial melalui lingkungan lokal yang aman; jangan kirim password,
PAT, connection string lengkap, atau dump Auth lewat chat atau commit GitHub.
Export roles, schema dan data, lalu periksa customisasi Auth/Storage dari
migration/schema aktual. Default dump schema saja tidak mencukupi untuk seluruh
policy/trigger custom pada schema yang dikelola Supabase.

Sebelum restore, siapkan lingkungan Supabase lokal/uji dengan job dan email
terkendali. Jalankan [inventaris read-only](../supabase/queries/backup_inventory_readonly.sql)
pada sumber dan hasil restore memakai akses operator yang setara. Bandingkan
snapshot dari waktu backup; database_bytes hanya informasi, bukan ukuran yang
harus identik setelah restore. Verifikasi definisi policy/trigger/RPC serta
akses nyata, bukan jumlah objek saja.
