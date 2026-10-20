# Anggota tim saat finalisasi — 15 Oktober 2026

Owner mengoreksi aturan lama “pernah bergabung”: Detail Squad dan kedua pihak
Endorsement harus memakai anggota saat finalisasi. Alur normal: finalisasi → lomba
→ kirim hasil → APPROVED oleh admin → penilaian dalam 14 hari. Approval, bukan
tanggal lomba atau finalisasi, tetap menjadi awal jendela penilaian.

## Perubahan

- View `finalized_squad_members` memakai interval membership yang sudah tersimpan:
  `joined_at <= finalized_at AND (ended_at IS NULL OR ended_at > finalized_at)`.
  Status Squad harus FINALIZED/MISSION_COMPLETED dan anchor tidak boleh kosong.
- Tidak membuat tabel salinan, backfill, cron atau query per rekan. Perbandingan
  timestamp dikerjakan PostgreSQL agar presisi mikrodetik dan timezone konsisten.
- View security_invoker mengikuti RLS squads/squad_members. Authenticated hanya
  SELECT; anon tidak mendapat akses. Tidak menambah SECURITY DEFINER/RPC.
- Daftar detail, loader shared Squad, Server Action dan trigger INSERT memakai
  sumber yang sama. Keluar/kick sebelum atau tepat finalisasi serta join setelah
  finalisasi dikecualikan. Removal sesudah finalisasi tetap bagian tim final;
  eligibility ini tidak sama dengan kebijakan XP ACTIVE saat approval.
- Daftar memperlihatkan user sendiri sebagai (Kamu), tanpa aksi menilai diri.
  Mantan anggota sebelum finalisasi tetap dapat membaca history, tanpa tombol nilai.
- Guard Squad menjaga finalized_at hanya dapat diubah melalui jalur internal;
  pemanggilan finalize_squad tetap berjalan. Aturan existing lain dipertahankan.
- Empat skor, sender ownership, no self/duplicate, jendela 336 jam, revalidation,
  XP/hasil/keanggotaan/rating existing dan akses Room/chat tetap mengikuti aturan.

Migration live: `20261015031820_finalized_roster_endorsements.sql`.
CLI membuat file terlebih dahulu; filename disamakan dengan versi history MCP.
Guard existing diganti tanpa mengubah ACL; tidak ada data yang dihapus/di-backfill.

## Bukti dan batas

- Readonly sebelum perubahan: Radhif berakhir 14 Oktober 20:12:49 WIB;
  finalisasi Pasti Juara 20:14:55 WIB. Tiga peserta final: Rizky, Arrafi, Muzamzamah.
  Tidak ada rating existing yang melanggar kriteria baru.
- 62 tes aplikasi, lint dan build production/TypeScript PASS. Tes memeriksa view
  sebagai sumber UI/action/shared loader, penolakan kedua pihak nonpeserta,
  daftar diri tanpa self-rating, history former-member dan read error.
- Prospective SQL dengan view/guard INSERT dan fixture rollback PASS: finalisasi
  lewat RPC, sebelum/exact exit, kick, join terlambat, removal sesudah finalisasi,
  rejoin, sender/recipient, ACL, duplicate dan expiry. Fixture tidak membuat XP.
- Setelah proteksi anchor ditambahkan, migration lengkap lulus pemasangan PostgreSQL
  terisolasi. Verifikasi live role authenticated: roster tiga peserta, Radhif tidak
  masuk, INSERT dari/ke Radhif ditolak, Ketua tidak bisa menulis ulang finalized_at.
  Semua percobaan live dibungkus ROLLBACK; bukan login Auth/browser.
- Pemanggilan ulang suite fixture panjang melalui MCP mengalami expired requestState;
  tidak diklaim PASS ulang. Pengujian live dipersempit ke skenario di atas.
- Counts sebelum/sesudah: endorsements 1, XP ledger 7, Squad 7, Mission 2,
  membership 11, notification 22; fixture QA tertinggal 0. View invoker/ACL benar.
- Browser owner dan true concurrent COMMIT belum diuji. Suite fixture lengkap yang
  dapat dijalankan ada di `supabase/tests/finalized_roster_runtime_rollback.sql`.

## Cek owner

Jika memakai npm start: stop server, `git pull origin main`, `npm run build`,
`npm start`. Buka My Squad → Riwayat → Pasti Juara → Detail Squad: roster harus
hanya Rizky, Arrafi, Muzamzamah. Radhif tetap punya history; bukan pasangan penilaian.
