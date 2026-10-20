# Jendela Endorsement — 15 Oktober 2026

## Keputusan dan perilaku

- Owner menyetujui pengajuan selama 14 x 24 jam sejak hasil Mission disetujui.
- Anchor `squads.completed_at` sudah ditulis approval dan dilindungi guard update.
- Awal inklusif, akhir eksklusif: INSERT ditolak saat waktu >= completed_at + 336 hours.
- Database memakai clock_timestamp(), sehingga transaksi lama tidak membekukan waktu.
- Timestamp kosong/future ditolak. Satu Squad lama sudah expired; tidak diberi waktu baru.
- Penilaian yang sudah ada dipertahankan dan tetap dihitung dalam ringkasan.
- Eligibility riwayat satu Squad, termasuk LEFT/KICKED, dan satu pasangan arah per
  Squad tetap. Empat skor 1–5; tidak menambah XP atau mengubah Rank.

## Implementasi

Migration `20261015014057_limit_endorsements_to_14_days.sql` mengganti guard INSERT
existing sebagai SECURITY INVOKER; search_path kosong dan ACL existing dipertahankan.
Tidak menambah kolom, tabel, index, cron, polling, atau SECURITY DEFINER.
Lookup Squad tetap lewat PK; membership tetap memakai predicate existing.

Loader membaca completed_at dalam query Squad existing; helper menghitung deadline.
Form menampilkan tanggal WIB dan status ditutup. Server Action memeriksa ulang dan
menerjemahkan race expiry dari trigger menjadi pesan aman; form lama direfresh
setelah penolakan expiry. Tidak ada countdown atau request database berkala.

## Bukti

- Migration sudah diterapkan; versi file diselaraskan dengan history Supabase MCP.
- PostgreSQL terisolasi menjalankan trigger aktual: open/exact/expired/future/null,
  sender, duplicate, rating lama tetap, wall-clock transaksi dan durasi lintas DST PASS.
- SQL/RLS hosted dengan dua STUDENT QA dan fixture baru: open, identitas pengirim,
  duplicate, batas tepat/expired/future PASS. Seluruh perubahan fixture di-rollback;
  tidak menjalankan approval, menambah XP atau menyentuh sertifikat.
- Sesudah tes: 0 fixture tertinggal; jumlah rating, XP, Squad, Mission, membership
  dan notifikasi kembali sama. Satu rating existing tetap ada.
- 51 tes aplikasi, lint dan production build/TypeScript PASS pada kandidat.
- Advisor tidak menambah temuan: 2 guarded definer views, 18 authenticated definer
  functions dan leaked-password protection disabled masih backlog review existing.
  Rujukan: [views](https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view),
  [functions](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable),
  [password](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

Browser owner sesudah pull belum diuji untuk UI deadline. Tes SQL memakai role/JWT
simulasi; bukan login Auth atau E2E browser. Endorsement pada Squad baru dapat diuji
melalui profil rekan; setelah kirim/F5 tampil Sudah dinilai dan XP tetap.
