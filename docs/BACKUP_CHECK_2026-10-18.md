# NEXUS — pemeriksaan backup 18 Oktober 2026

## Hasil

**PARTIAL:** file Storage telah dicadangkan dan keutuhan arsip diuji lokal.
Backup database dan pemulihan aplikasi terpisah belum dilakukan.

Pemeriksaan ini tidak mengubah data/schema/RLS, mengambil isi chat, membuat
layanan berbayar, atau memulihkan database produksi. Sumber code saat pemeriksaan:
`66d5d380b6f1f8494bfb1e5dcd778df8c6a3c72e` (#56).

## Inventaris sumber

Query agregat dijalankan dalam transaksi REPEATABLE READ READ ONLY pada
18 Oktober 2026 pukul 13:51:24 WIB. Ini snapshot pembanding, bukan dump data.

| Data | Jumlah pada snapshot |
| --- | ---: |
| Akun Auth / profil | 7 / 7 |
| Mission / Squad | 1 / 1 |
| Anggota Squad / aplikasi | 2 / 1 |
| Pesan chat (hanya COUNT, isi tidak dibaca) | 3 |
| Transaksi XP | 0 |
| Tabel public dengan RLS aktif | 28 / 28 |
| Policy public (inventaris, bukan audit definisi) | 99 |
| Referensi file unik dari tabel aplikasi | 5 |
| Referensi tanpa metadata object yang cocok | 0 |

Database memakai Postgres 17. Metadata organisasi menunjukkan paket Free.
Daftar development branch kosong. Backup terjadwal yang dapat diunduh tidak
dapat diasumsikan tersedia; jalur yang dipilih adalah export manual operator.

## File Storage

| Bucket | Object saat diperiksa | Visibilitas |
| --- | ---: | --- |
| avatars | 6 | Publik |
| mission-documents | 0 | Privat |
| mission-result-certificates | 0 | Privat |
| achievement-certificates | 0 | Privat |

Keenam avatar, termasuk object yang tidak sedang dirujuk profil, disalin tanpa
menghapus file apa pun. Total file asli: 1.788.378 byte. Ukuran setiap download
dicocokkan dengan metadata; SHA-256 dicatat. Bucket dan metadata object diperiksa
ulang pada 13:54:13 WIB dan tidak berubah selama penyalinan.

Arsip privat `NEXUS_Storage_Backup_2026-10-18.zip` disimpan terpisah dari repo.
ZIP lolos CRC, diekstrak ke direktori sementara, dan seluruh enam hasil ekstraksi
lolos pembandingan ukuran/SHA-256. Hash arsip:
`785f72dce75fc687487adb983def478f3dcc6973b0fae89b96faf39a377bf60a`.
Arsip berisi file, metadata/konfigurasi bucket, inventaris agregat, dan pemeriksa
keutuhan. Tidak berisi dump tabel, data Auth, password, atau secrets.

## Belum dapat diverifikasi

Tidak ada kredensial/connection string operator, CLI database, Docker, atau
tujuan restore terpisah di lingkungan sesi ini. Connector yang tersedia dapat
menjalankan SQL, tetapi tidak menyediakan operasi unduh backup penuh. Karena itu:

- Export roles/schema/data serta customisasi Auth/Storage belum dilakukan.
- Restore ke Supabase lokal/uji, login, role/RLS, RPC dan file setelah restore
  belum dinyatakan PASS.
- Lolos ekstraksi ZIP hanya membuktikan integritas salinan file, bukan pemulihan
  layanan Storage atau aplikasi.

Langkah berikutnya terdapat pada [panduan backup](BACKUP_AND_RECOVERY.md).
Query agregat yang dipakai disimpan di
[backup_inventory_readonly.sql](../supabase/queries/backup_inventory_readonly.sql).
