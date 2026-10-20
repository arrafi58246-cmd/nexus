# Identitas pengirim chat — 14 Oktober 2026

Owner melaporkan browser Apply → PENDING, Tolak, Terima dan akses Room berhasil.
Screenshot menampilkan lamaran dan dua pesan berlabel Kamu. Pemeriksaan read-only
menemukan kedua pesan tersebut memiliki sender_id akun Ketua yang sama.
Ini bukti laporan alur recruitment dan pesan tersimpan, belum delivery Realtime dua akun.

## Perubahan

- SquadChat menampilkan nama lengkap pengirim; pesan sendiri berpenanda `(Kamu)`.
- Identitas memakai sender_id dan daftar anggota dari RPC Room existing.
- Nama tidak tersedia: Kamu untuk pesan sendiri, Mantan anggota untuk pengirim lain.
- Nama panjang dibungkus; teks dirender oleh React tanpa HTML mentah.
- Tidak ada query tambahan, perubahan payload kirim, schema, RLS atau migration.

## Verifikasi

- Render React dengan dua identitas: nama pengirim konsisten dari kedua sudut pandang;
  hanya pesan viewer sendiri berpenanda Kamu, fallback dan escaping nama diperiksa.
- Suite aplikasi, lint dan production build/TypeScript diperiksa pada kandidat ini.
- Owner perlu cek ulang label pada browser setelah pull. Delivery dua arah tanpa
  refresh, reconnect dan perubahan akses tetap belum tercatat PASS.
