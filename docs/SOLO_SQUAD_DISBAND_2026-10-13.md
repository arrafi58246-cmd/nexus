# Pembubaran Squad solo — 13 Oktober 2026

Keputusan owner: Ketua boleh membubarkan Squad jika menjadi satu-satunya anggota ACTIVE dan belum FINALIZED. Dengan anggota lain, Ketua menggunakan transfer untuk keluar. Pembubaran meminta konfirmasi, membatalkan PENDING dan memberi notifikasi pelamar; riwayat tetap disimpan.

## Implementasi

- Status terminal DISBANDED dengan disbanded_at/disbanded_by; completed_at/finalized_at tetap kosong. Ekstensi enum dipisahkan dari migration yang memakai nilainya.
- RPC disband_solo_squad(uuid): STUDENT ACTIVE/onboarded dan Ketua; lock/recheck roster dan profil, tandai Squad, akhiri membership menjadi LEFT dengan ended_at/removal_reason, batalkan PENDING pada Squad itu dan buat notifikasi SQUAD_DISBANDED dalam satu transaksi.
- Retry oleh Ketua pada Squad yang sudah dibubarkan idempotent. Tidak menambah XP, menghapus history/requirements/chat langsung, atau membatalkan lamaran ke Squad lain. Chat tetap mengikuti kebijakan cleanup idle existing.
- Urutan lock mengikuti application RPC existing: advisory applicant terurut → application terurut → Squad → profil/anggota. Lamaran baru di luar snapshot menyebabkan 40001 dan pengguna diminta muat ulang; tidak mengambil lock application baru setelah parent terkunci.
- Guard menolak direct disband/reopen dan penambahan/reactivation anggota ACTIVE pada Squad DISBANDED. Chat/RPC Room ditutup; trigger memeriksa status lagi setelah parent lock untuk write chat.
- Server Action disbandSoloSquad(squadId) pada disband-actions.ts mengembalikan MembershipActionResult. Refresh biasa; error aman. Tombol hanya muncul untuk Ketua solo sebelum Finalized. Berhasil menuju My Squad.
- Home/recruitment mengecualikan DISBANDED. My Squad menyimpan history dengan label Dibubarkan dan link Mission.

## Verifikasi

| Pemeriksaan | Hasil dan batas |
|---|---|
| PostgreSQL lokal | PASS: semua migration compile, state/cancel/notification/history, idempotence, deny cases, admin/suspended dan failure injection pada notifikasi; kegagalan tidak meninggalkan perubahan parsial atau internal mode. Emulator tidak mereproduksi seluruh hosted RLS. |
| Supabase live | PASS: solo_disband_runtime_rollback.sql memakai empat akun QA existing, Mission baru hanya dalam transaksi, RPC sebagai authenticated dan semua fixture rollback. Tidak login Auth/browser atau mengubah identitas akun. |
| Data setelah tes | Squad 6, application 5, notification 11 dan row XP 4, sama dengan sebelum tes. Tidak ada fixture concurrency committed. |
| ACL | anon tidak boleh EXECUTE RPC; authenticated boleh. Role/profil diperiksa ulang di dalam RPC. |
| Aplikasi | 33 tes PASS, lint dan build/TypeScript PASS; mencakup guard/error/revalidation action dan label/link history. Belum browser klik konfirmasi/mutasi live. |
| Concurrency | Pemetaan lock dan acceptance-before/disband deny states diperiksa. Percobaan worker rollback tidak menangkap blocker pada observer (0), sehingga tidak diklaim concurrency dua sesi PASS. |

Pembuatan fixture concurrency committed ditolak pemeriksaan persetujuan otomatis; tidak diulang. Pengujian dilanjutkan dengan rollback pada Squad QA existing dan data dipastikan tetap. Concurrency COMMIT/lamaran baru saat disband serta browser dua STUDENT/ADMIN masih perlu bukti sebelum rilis.

Migration live: 20261013141326_add_disbanded_squad_status, 20261013141336_guard_disbanded_squad_state, 20261013141347_atomic_solo_squad_disband. Tidak menjalankan ulang migration setelah pull.

## Menjalankan pemeriksaan

- npm test, npm run lint, npm run build: kode aplikasi.
- supabase/tests/solo_disband_runtime_rollback.sql: owner SQL dengan empat akun QA khusus existing; seluruh data tes rollback.
- Browser: Ketua solo melihat tombol, cancel konfirmasi tidak memanggil action, confirm berhasil menuju history; refresh recruitment tidak menampilkan Squad; pelamar melihat lamaran dibatalkan/notifikasi. Dengan anggota lain/Finalized, tombol tidak tersedia dan request palsu ditolak.

Keputusan G02 mengubah batas Mission dengan Squad existing serta gate hosting/backup/browser lainnya tetap terpisah. Supabase tetap memakai project existing yang direncanakan untuk produksi.
