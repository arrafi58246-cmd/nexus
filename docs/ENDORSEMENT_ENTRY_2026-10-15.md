# Penilaian melalui riwayat Squad — 15 Oktober 2026

Owner meminta akses rekan tanpa harus mencari lewat Leaderboard. Entry utama kini
My Squad → Riwayat Squad selesai → Detail Squad → pilih nama rekan → Nilai rekan.
Leaderboard/profil umum tetap dapat digunakan; ranking bukan syarat eligibility.
Koreksi berikutnya memakai anggota saat finalisasi, bukan semua riwayat anggota;
lihat [roster final](FINALIZED_SQUAD_ROSTER_2026-10-15.md).

## Perilaku dan akses

- Kartu history MISSION_COMPLETED memiliki satu tombol utama Detail Squad dan
  tautan kecil Lihat Mission, termasuk untuk membership historis.
- Route `/squads/[squadId]/endorsements` memverifikasi sesi, STUDENT ACTIVE,
  onboarding, membership user dan status completed sebelum membaca daftar rekan.
- Halaman ini menjadi Detail Squad: hasil approved, XP user dari ledger, daftar
  rekan dan penilaian. Snapshot hasil mengambil relasi xp_transactions dengan filter
  user_id caller dan RLS existing; tidak menyalin approved_xp sebagai XP user.
- Tautan pengajuan hasil hanya untuk membership ACTIVE sesuai guard halaman existing.
  URL Room completed milik anggota ACTIVE diarahkan ke detail sebelum query chat/RPC.
- Nama rekan dibaca sekaligus dari public_profiles; tidak memakai email/NIM,
  mengabaikan duplikasi membership; user sendiri berlabel (Kamu) tanpa tombol menilai.
- Daftar menampilkan sudah/belum dinilai atau penilaian ditutup, beserta batas WIB.
- Profil menerima `?squad=UUID` yang cocok dengan shared Squad eligible existing.
  Form terbatas pada konteks yang dipilih; tautan kembali menuju daftar rekan.
  Parameter invalid/asing tidak memberi eligibility atau membuat redirect eksternal.
- Jendela 14 hari dan anti-self/duplicate tetap. Eligibility pasangan mengikuti
  anggota saat finalisasi; mantan anggota sebelum finalisasi hanya membaca history.
- Setelah penilaian berhasil, route daftar rekan ikut direvalidasi agar status saat
  kembali mencerminkan penilaian yang baru dikirim.
- Tidak membuka kembali Room/chat atau memberi XP. View roster baru memakai RLS
  tabel asal; tidak menambah tabel salinan anggota.

## Efisiensi dan bukti

- MySquadPage tidak berubah; tidak ada query baru pada daftar kartu.
- Prefetch link baru dimatikan. Detail mengambil membership/rating dan nama secara
  batch saat dibuka, tanpa request per rekan, polling atau pengambilan avatar.
- Bukti kandidat Detail Squad sebelum koreksi roster: 59 tes aplikasi, lint dan
  production build/TypeScript PASS. Bukti koreksi roster ada di laporan terpisah.
  Tes mencakup route guard, nama publik terfilter, deduplikasi, expiry/rated,
  empty/error, prefetch dan validasi konteks/back link.
- Regresi tambahan: dua akses ringkas pada kartu, hasil admin approved, XP caller,
  snapshot gagal tidak memalsukan hasil/XP, historical member dan redirect completed
  tanpa mengakses chat. Snapshot SELECT dengan role authenticated membaca Participant
  dan satu transaksi 230 XP milik owner.
- Pembacaan SQL dengan role authenticated pada Squad owner mengembalikan tiga
  profil rekan yang dapat dibaca pada perilaku lama. Koreksi terbaru mengecualikan
  Radhif yang keluar sebelum finalisasi; baca laporan roster final.
- Review React: Server Components untuk data/navigation, query independen paralel,
  plain-text escaping, stable keys, link native, empty/error terpisah, tanpa hook baru.

Belum ada E2E browser owner pada detail baru. Sesudah pull, buka My Squad →
Riwayat Pasti Juara → Detail Squad, pilih profil dan periksa konteks serta kembali.
Tes SQL memakai role/JWT simulasi dan unit render memakai fixture; bukan login Auth.
Jika menjalankan npm start, build ulang dan restart sesudah pull untuk memuat UI baru.
