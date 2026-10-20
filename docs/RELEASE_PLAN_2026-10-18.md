# NEXUS — rencana rilis dan arsip pemeriksaan

**Pembaruan 18 Oktober:** aplikasi sudah tayang di https://nexus-unesa.vercel.app.
Catatan terkini ada di [catatan rilis](RELEASE_NOTES_2026-10-18.md), termasuk panel
admin, hasil tes owner, dan batas verifikasi backup. Bagian di bawah adalah
**arsip keadaan 13–15 Oktober**, bukan status deployment atau daftar tes tersisa
yang berlaku saat ini. Pernyataan “deployment belum dibuat” dan “mobile/chat belum
diuji” di arsip telah digantikan oleh pembaruan tersebut.

## Arsip rencana yang diperbarui 15 Oktober 2026

Target backend siap integrasi **18 Oktober**; 19–20 Oktober cadangan. Rilis lengkap bergantung pada pengujian browser dan deployment. Frontend tanggal 15 belum dijanjikan tim frontend. Tidak ada pekerjaan otomatis di luar sesi aktif.

**Hosting dipilih 15 Oktober:** Vercel Hobby gratis memakai Supabase existing.
Empat form disiapkan untuk direct upload agar batas file produk tidak terhalang
payload Vercel; suite 72 tes, lint/build dan audit produksi PASS secara lokal.
Deployment belum dibuat: workspace owner menolak akses koneksi dengan HTTP 403.
[Konfigurasi, kontrak, bukti dan langkah owner](VERCEL_HOBBY_DEPLOY_2026-10-15.md).

Baseline backend main: cd0fe898e2fbfcf0f2cd3cc63eabfb042c5ae95f. Kandidat memakai frontend PR #29 pada 5313bb925cb433a9f75210fd18be17ff71fcdf0d serta badge PR #32 pada e001d0c002ebd385b891b293c3368f6d445a0256. Konflik PRD mempertahankan keputusan G05/G06 terbaru. Branch teman tidak ditulis ulang; CI kandidat menjadi syarat merge.

**Koreksi roster 15 Oktober:** owner melaporkan Radhif (LEFT sebelum finalisasi)
masih muncul di Detail Squad. Daftar tim dan kedua pihak Endorsement sekarang
memakai anggota pada waktu finalisasi. View read-only security_invoker dan guard
INSERT/anchor finalisasi diterapkan; history dan XP tidak diubah. Suite 62 tes,
lint/build PASS; SQL prospektif serta verifikasi live terarah PASS. Browser owner
sesudah pull dilaporkan aman (lihat QA owner di bawah). [Bukti dan batas](FINALIZED_SQUAD_ROSTER_2026-10-15.md).

**QA owner 15 Oktober — dilaporkan PASS:** Detail Squad/Endorsement sudah dicek:
persist setelah F5, tidak menilai ulang dan XP tetap. Pengajuan Mission baru
Tolak → edit → kirim ulang → Setujui aman. Klaim Prestasi: sertifikat admin,
Tolak → perbaiki → kirim ulang → Setujui, Legacy XP dan F5 tanpa double credit
juga dilaporkan aman. Ini laporan browser localhost owner, bukan pengujian ulang
independen atau deployment. Chat dua akun tanpa F5/reconnect dan mobile belum
terverifikasi; owner memilih pekerjaan keamanan berikutnya.

**Review akses 15 Oktober:** izin tulis berlebih current_seasonal_xp_totals dibatasi
menjadi SELECT; definition/RLS/policy dan data tetap. Dua suite SQL otomatis baru
PASS: catalog ACL/RLS/18 RPC serta 32 probe denial missing/suspended dan forged
metadata, dengan output view ACTIVE terjaga. [Laporan](security/RELEASE_ACCESS_REVIEW_2026-10-15.md).

## Sudah dikerjakan dan batas buktinya

| Area | Status 13 Oktober |
|---|---|
| Kontrak collaborator | PR #28 merged: HTTP/Server Action, input/output/error/role, Storage dan refresh/realtime. Addendum mencakup transfer Ketua serta helper login. |
| Bukti concurrency | PR #30/#31 merged: Skill ke-5/ke-6, akses Endorsement, cleanup/chat dua urutan dan closure/Legacy approval memiliki bukti terbatas dalam laporan masing-masing. Migration #31 sudah live, tidak dijalankan ulang. |
| Lifecycle Squad | PR #33 merged dan live: Create membatalkan PENDING pembuat pada Mission sama secara atomic; transfer sebelum Finalized. SQL/RPC/action regression PASS. Owner melaporkan tes manual aman tanpa rincian seluruh skenario browser. |
| Dependency | PR #34 merged: Next 16.3.8, React 19.2.8 serta lockfile terkait. Audit production kandidat: 0 vulnerability. Audit penuh terakhir masih 5 high pada dependency development; tidak memakai force fix. |
| Akses database | PR #35–#37 merged/live: hak maintenance klien pada tabel yang dipetakan dicabut, search_path/ACL/guard view XP diperbaiki, flag internal kick/finalize dipulihkan. Runtime/assertion sesuai laporan PASS. |
| SUSPENDED/bukti hasil | PR #38/#40 merged/live: write notification/Storage memerlukan akun aktif; file bukti hasil yang masih direferensikan tidak boleh diganti/dihapus klien. Beberapa tes metadata Storage hanya pada emulator lokal. |
| Auth/avatar | PR #39 merged. Owner melaporkan auth-avatar.mjs PASS: login/profil ACTIVE, upload/baca publik, simpan foto, pulihkan foto awal, cleanup. Bukan tes cookie/browser. |
| Dokumen privat | Owner melaporkan documents.mjs PASS pada tiga bucket: upload, signed download, akses publik ditolak, MIME terlarang ditolak, cleanup. Opsi size-limits belum dilaporkan dijalankan. |
| Badge profil | Kandidat menormalisasi respons relasi objek/array; 4 tes page regression PASS. Tidak mengubah award/equip. Posisi pertama bukan jaminan badge di luar jadwal award. |
| Frontend | Kandidat menggabungkan 31 file PR #29: Home/XP/Missions/Profile/Leaderboard/Squad dan tema bersama. Handler/action/ACL terbaru tetap utuh; retry mengambil ulang data, tautan review Mission tersedia di mobile. |
| Kandidat gabungan | Lint, production build/TypeScript dan 19 tes PASS. HTTP production /login, CSS/logo/background 200; kontrol email/password dan submit kosong disabled ter-render. Tidak mengirim kredensial; bukan browser login atau verifikasi seluruh desain. |

**Lanjutan sesi 13 Oktober:** Proxy refresh cookie server dan env preflight ditambahkan setelah baseline integrasi di atas. Total suite kini **27 tes PASS**; lint/build PASS. SDK SSR asli dengan Auth lokal sintetis membuktikan satu refresh token expired dan persist cookie/cache headers. HTTP production anon/role boundary juga diperiksa dengan env sintetis. Ini belum menggantikan login browser/project uji sebenarnya. Detail: [SSR session dan env readiness](security/SSR_SESSION_RELEASE_CHECK_2026-10-13.md).

[FRONTEND_HANDOFF](FRONTEND_HANDOFF.md) berisi bukti dari penulis PR, bukan pengujian ulang backend pada kandidat gabungan. Tes Home/badge memakai respons sintetis pada page asli, tanpa route bypass atau seed demo.

Bukti scheduler 12 Oktober: award mingguan 00.00 WIB succeeded, menambah 9 badge; total saat audit 22 dan XP 1.115. Cleanup 02.00 WIB serta season worker succeeded. Ini snapshot tanggal tersebut, bukan jumlah terkini atau bukti rollover Juli nyata.

## Belum selesai

**Browser owner 14 Oktober:** STUDENT refresh Home/Profil PASS, akses `/admin/results` ditolak 404; ADMIN review/refresh PASS. Logout ditemukan belum tersedia, sehingga tombol Keluar ditambahkan untuk kedua role. Suite kini 37 tes PASS, lint/build serta request logout production dengan Auth lokal sintetis PASS. Logout browser hosted dan mobile belum diuji. [Bukti dan langkah berikutnya](security/LOGOUT_BROWSER_CHECK_2026-10-14.md). Localhost memakai project existing yang akan menjadi produksi; tidak dinyatakan sebagai testing terisolasi.

**Lanjutan UI 14 Oktober:** owner melaporkan logout STUDENT/ADMIN, solo disband ikan sepat, create Squad baru pasti juara, masuk Room dan kirim chat berhasil. Screenshot history disband tersedia; Room/chat berasal dari laporan owner, belum membuktikan delivery Realtime dua akun. Kartu notifikasi sekarang dibaca saat dibuka dengan dot; UUID action diperbaiki. Dropdown tambah Skill mengikuti Class pilihan, data existing tetap. Suite 45 tes, lint/build, React DOM lokal dan HTTP production sintetis PASS; browser hosted fitur UI baru belum diuji. [Laporan](NOTIFICATION_AND_SKILL_UI_2026-10-14.md).

**Recruitment dan chat 14 Oktober:** owner melaporkan Apply/PENDING, Tolak, Terima dan masuk Room PASS. Dua pesan pada screenshot memiliki sender_id Ketua yang sama menurut pemeriksaan read-only. Label chat sekarang menampilkan nama lengkap, dengan `(Kamu)` hanya untuk pesan sendiri, memakai data anggota existing tanpa query tambahan. Render dua identitas, suite 45 tes, lint/build PASS pada kandidat; label browser setelah pull dan delivery Realtime dua akun tanpa refresh/reconnect belum diverifikasi. [Rincian identitas pengirim](CHAT_SENDER_UI_2026-10-14.md).

**G06 diputuskan dan diterapkan 13 Oktober:** Ketua solo boleh membubarkan Squad sebelum FINALIZED. Migration/RPC live, rollback QA serta 33 tes aplikasi PASS; history/cancel/notifikasi ditangani atomic. [Laporan solo disband](SOLO_SQUAD_DISBAND_2026-10-13.md). Browser dan concurrency dua sesi belum dinyatakan PASS.

1. **Browser gabungan:** dua STUDENT dan satu ADMIN pada environment uji yang dinyatakan. Login/cookie/refresh, onboarding, discovery/filter, Create/Join/accept/reject, transfer/leave/finalize, upload form/signed review, approval → XP/badge/history, notifications, chat/reconnect dan mobile. Tes API Storage tidak menutup alur form/approval.
2. **Operasional deploy:** environment development/staging/production, env hosting, Auth redirect/domain, log, backup dan pemulihan belum tercatat sebagai gate PASS. Produksi belum dideploy dalam sesi ini.
3. **Keputusan/data legacy:** G02 perubahan batas Mission yang punya Squad. G06 solo disband sudah diterapkan; verifikasi browser/concurrency tetap masuk gate. Empat profil domain lama memerlukan klasifikasi QA/asli sebelum perubahan identitas; tidak mengganti email/password otomatis.
4. **Keamanan/Auth:** review 15 Oktober memetakan 2 guarded definer view dan 18 RPC authenticated (termasuk solo disband). Assertion katalog dan role/JWT rollback PASS pada batas yang diuji; grant tulis view total XP musiman telah dicabut. Advisory tetap tampil karena akses definer memang diperlukan. Leaked-password protection masih disabled dan memerlukan pengaturan Auth dashboard; bukan klaim audit keamanan global PASS. [Hasil dan batas](security/RELEASE_ACCESS_REVIEW_2026-10-15.md).
5. **Tes terbatas:** concurrency closure/Verified dua urutan COMMIT, cleanup vs submit hasil dan batas ukuran Storage langsung belum tercakup seluruhnya. Gunakan fixture/environment terisolasi; approval nyata memengaruhi XP/badge.

Admin Intervention tetap ditunda. Achievement Title Badge, PDF rank reward, poster publik baru, countdown/progress pekerjaan dan fitur di luar kontrak tidak ditambahkan. G08/G09/UI-G07 mengikuti perilaku existing sampai keputusan diperlukan untuk perubahan terkait.

## Jadwal berikutnya

**QA owner 14 Oktober:** Apply/Tolak/Terima/Room, anggota keluar dan akses Room
ditolak dilaporkan aman. Owner menjalankan hasil Mission Tolak → kirim ulang →
Setujui; pemeriksaan read-only membuktikan MISSION_COMPLETED/APPROVED, tiga anggota
ACTIVE masing-masing satu transaksi 230 XP, anggota LEFT tidak mendapat reward,
satu record hasil dan 0 pesan chat. Transfer Ketua sempat dilaporkan aman tetapi
urutan aktor belum jelas; tidak ditandai seluruh skenario browser PASS.

**Endorsement 15 Oktober:** batas 14 hari disetujui dan diterapkan pada trigger,
Server Action dan form tanpa query tambahan/polling. SQL terisolasi dan hosted
rollback PASS, counts/ACL tetap; 51 tes aplikasi, lint/build PASS. Deadline browser
owner sesudah pull belum diuji. [Rincian dan batas bukti](ENDORSEMENT_WINDOW_2026-10-15.md).

**Entry Endorsement 15 Oktober:** owner melaporkan pembaruan sebelumnya done,
lalu meminta akses rekan melalui riwayat tim. My Squad history kini membuka daftar
rekan dari Squad completed; profil membawa konteks Squad dan link kembali.
Tidak ada query baru pada daftar My Squad, migration atau perubahan eligibility.
56 tes, lint/build PASS; SQL read dengan role authenticated dapat membaca nama
rekan melalui proyeksi publik. Browser entry baru masih perlu dicek owner.
[Detail](ENDORSEMENT_ENTRY_2026-10-15.md).

**Detail Squad selesai 15 Oktober:** owner masih kesulitan mengakses tim setelah
Room ditutup. Kartu completed diringkas menjadi Detail Squad + tautan kecil Mission;
detail menampilkan hasil approved, XP caller dari ledger, daftar rekan dan penilaian.
URL Room completed milik anggota ACTIVE redirect ke detail sebelum query chat.
59 tes, lint/build PASS; SQL authenticated memverifikasi snapshot owner. Browser
detail baru belum dicek owner; npm start memerlukan build ulang/restart setelah pull.

| Tanggal WIB | Pemilik | Hasil yang dituju |
|---|---|---|
| 13–14 Okt | Backend + frontend | Merge kandidat setelah CI, perbaiki bug integrasi, siapkan regresi dan staging. Remediasi awal dependency/akses sudah dilakukan. |
| 15 Okt | Bersama | Evaluasi kesiapan frontend dan hasil browser; bukan deadline frontend yang telah dikonfirmasi. |
| 15–16 Okt | Owner + tim | Alur utama dua STUDENT/ADMIN; catat expected/actual, commit, environment, bug dan cleanup. |
| 17 Okt | Bersama | Tutup bug penghambat; cek mobile/error/role/realtime dan hosting/backup. |
| 18 Okt | Backend/owner | Target backend siap; deploy setelah kandidat dan gate rilis lulus. |
| 19–20 Okt | Bersama | Cadangan integrasi/deploy dan pemeriksaan sesudah deploy. |

Kemajuan kode mendukung jadwal. Rilis sebelum 20 Oktober belum dapat dijamin selama gate browser/deployment belum lulus. Persentase implementasi bukan persentase acceptance test.

## Gate sebelum deploy

- [ ] Kandidat final tergabung, CI commit kandidat lulus dan history migration cocok dengan database.
- [ ] Temuan penghambat ditutup/diterima dengan bukti; audit production memenuhi gate.
- [ ] Alur browser/role/error, Storage form, chat dan refresh lulus pada environment yang dinyatakan.
- [ ] Keputusan blocking selesai; data legacy tidak menggagalkan penggunaan normal.
- [ ] Env, Auth redirect, domain/deployment, log, backup dan pemulihan diperiksa.
- [ ] Fixture/file tes dibersihkan dan owner menyetujui deployment produksi konkret.

## Bukti dan pemeriksaan

- [Lifecycle Squad](SQUAD_LIFECYCLE_2026-10-12.md), [Skill/Endorsement](skills_concurrency_endorsement_access_qa.md), [operational concurrency](privilege_hardening_operations_concurrency_qa.md), serta [security reviews](security/).
- npm test, npm run lint, npm run build, npm run audit:production: pemeriksaan kode kandidat.
- npm run qa:environment: bentuk URL/key; tambahkan -- --testing untuk memeriksa deklarasi environment QA. Tidak melakukan request atau menampilkan key.
- scripts/qa/auth-avatar.mjs dan documents.mjs: hasil API owner dicatat di atas; tidak perlu diulang tanpa alasan.
- supabase/tests/operations_readiness_readonly.sql dan dashboard_reads_runtime_readonly.sql: metadata/SQL/RLS, bukan Auth/REST/browser.

