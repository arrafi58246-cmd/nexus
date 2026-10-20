# NEXUS LPPM — Unified PRD & AI Agent Contract

Versi isi: 1.1 · Tanggal baseline: 7 September 2026 · Status: WORKING, konsolidasi kebutuhan MVP dan kontrak isi UI seluruh halaman. Nama file v1 dipertahankan agar referensi AGENTS.md tetap berlaku.

Dokumen ini menggabungkan requirement Handbook REV6 dan Database Specification v1, termasuk pembaruan WORKING. Ini bukan perintah untuk mengimplementasikan seluruh MVP sekaligus dan bukan bukti bahwa semua fitur sudah selesai. Tidak ada code, database, atau file sumber yang diubah saat penyusunan PRD ini.

## 0. Baca sebelum mengerjakan tugas

1. Baca bagian 1–4, requirement fitur yang ditugaskan, kontrak data, daftar gap, dan acceptance criteria terkait. Untuk pekerjaan UI, wajib baca bagian 17–19 dan UI-ID terkait; jangan hanya membaca bagian Mission.
2. Periksa AGENTS.md, repository, migration, dan schema terkait sebelum mengubah implementasi. Jangan memulai proyek ulang.
3. Bedakan **TARGET PRODUK**, **BUKTI STRUKTUR**, **HASIL TEST DILAPORKAN**, dan **BELUM TERVERIFIKASI**. Kalimat “wajib” berarti requirement, bukan klaim sudah deployed.
4. Kerjakan hanya scope permintaan pengguna. Menemukan gap tidak memberi izin memperbaiki semua gap.
5. Jika target berbeda dari implementasi, jelaskan perbedaan, dampak, dan perubahan minimum. Jangan menganggap code aktual otomatis merupakan aturan produk yang benar.
6. Item **NEEDS DECISION** bukan pilihan bebas agent. Tunda bagian yang bergantung padanya, minta keputusan spesifik, lanjutkan bagian independen jika aman.
7. Jangan membuat migration, menghapus data, mengubah RLS, memakai service role di frontend, atau deploy hanya karena membaca PRD.

### 0.1 Kamus status

| Label | Arti dan batas klaim |
|---|---|
| TARGET MVP | Wajib tersedia untuk MVP akhir; belum menyatakan progres |
| PLANNED — NOT YET DEPLOYED | Target sudah tercatat, implementasi belum terbukti diterapkan |
| STRUCTURE PRESENT | Object/code ditemukan pada sumber snapshot; bukan runtime PASS |
| IMPLEMENTATION REPORTED | WORKING melaporkan code tersedia; repository tidak diunggah untuk review PRD ini |
| TEST PASS — REPORTED | Hasil tes tercatat di WORKING/konteks; tidak dijalankan ulang dalam penyusunan PRD |
| PARTIAL | Sebagian lapisan tersedia, tetapi acceptance end-to-end belum terpenuhi |
| NOT VERIFIED | Bukti tidak mencukupi; jangan menggantinya dengan NOT IMPLEMENTED |
| NEEDS DECISION | Keputusan produk/operasional belum tuntas; tidak boleh diasumsikan |
| OUTSIDE MVP | Jangan implementasikan tanpa permintaan baru |

## 1. Sumber dan otoritas

| ID | Sumber | Fungsi |
|---|---|---|
| H0 | NEXUS_Handbook_REV6 (1).docx | Baseline produk, flow, terminologi, tabel XP |
| D0 | NEXUS_Database_Spec_v1 (2).md | Baseline 28 entitas dan keputusan teknis MVP |
| H1 | NEXUS_Handbook_REV6_WORKING_2026-09-07(1).docx | Keputusan terbaru dan progres yang dilaporkan |
| D1 | NEXUS_Database_Spec_v1_WORKING_2026-09-07(1).md | Pembaruan kontrak teknis dan rencana kapasitas Mission |
| A1 | Supabase Snippet Untitled query (2).csv | Snapshot inventaris public yang telah direview; bukan koneksi live |
| M1 | 20260906000000_get_mission_squad_leaders.sql | Migration dalam supabase_migrations.zip |
| M2 | 20260906010000_create_squad.sql | Migration dalam supabase_migrations.zip |
| C1 | Canva NEXUS, design ID DAHNXwyayR0; tautan pada bagian 17 | Acuan isi UI; ekstraksi teks seluruh desain dibaca dalam percakapan, bukan bukti code atau schema |

File lama dengan suffix (1)(1)/(2)(1) yang diunggah ulang identik dengan H0/D0. H1/D1 masih tersedia dari unggahan sebelumnya dan digunakan untuk konsolidasi.

**Otoritas fakta implementasi database:** schema Supabase aktual yang benar-benar diverifikasi dan migration aktual → snapshot A1/M1/M2 → laporan WORKING → asumsi percakapan. Untuk status frontend, gunakan repository dan hasil runtime yang benar-benar diperiksa. Jika migration/code dan remote berbeda, catat drift; file migration tidak membuktikan perubahan sudah deployed dan code frontend tidak mengalahkan fakta schema remote.

**Otoritas target produk:** instruksi eksplisit terbaru pengguna → keputusan konsolidasi yang bersumber H1/D1 di PRD ini → D1/D0 untuk konflik teknis → H1/H0 untuk kebutuhan produk lain. PRD ini menggantikan pembacaan gabungan dokumen lama sebagai pedoman kebutuhan, tetapi tidak mengalahkan bukti aktual mengenai apa yang sudah ada.

Riwayat perubahan lama diperlakukan sebagai sejarah, bukan perintah aktif. Admin Intervention sempat menjadi target MVP kembali, lalu laporan masalah Squad ditunda oleh keputusan ketua tim 8 Oktober 2026. Gap tanpa keputusan final dicatat pada bagian 13, bukan diberi dua aturan yang bertentangan.

**Otoritas isi UI:** instruksi pengguna menetapkan C1 sebagai acuan informasi, kontrol, dan pilihan yang terlihat; warna, layout, font, ikon, dan dekorasi tidak wajib ditiru. Aturan bisnis, keamanan, enum, dan scope tetap mengikuti aturan kanonik PRD. Konflik C1 dituntaskan atau diberi NEEDS DECISION pada bagian 18. Penambahan dokumentasi UI tidak mengubah status deployment bagian 12.

## 2. Tujuan, pengguna, dan scope

NEXUS adalah platform mahasiswa aktif Universitas Negeri Surabaya untuk menemukan kompetisi, membentuk tim berdasarkan kemampuan, dan membangun reputasi akademik dari prestasi tervalidasi. Tujuan: mengurangi pencarian rekan secara manual, membantu recruitment berbasis kemampuan/reputasi, memperkenalkan lomba internal maupun eksternal, dan mendorong partisipasi melalui progression.

Target keberhasilan MVP adalah satu alur lengkap dan aman: Auth → Onboarding → Mission → Squad → Validation → XP → Rank/Badge → Leaderboard → Endorsement/History. Keberhasilan dinilai melalui acceptance test, bukan jumlah tabel. Belum ada target angka adopsi, konversi, latency, SLA infrastruktur, atau anggaran yang disetujui; agent tidak boleh mengarang angka tersebut.

### 2.1 Aktor

| Aktor | Peran |
|---|---|
| Pengunjung belum login | Register/Login, tidak mengakses data privat |
| STUDENT ACTIVE, belum onboarding | Menyelesaikan onboarding sebelum flow utama |
| STUDENT ACTIVE, onboarding selesai | Discovery, Add Mission, Create/Apply Squad, profile, klaim prestasi |
| Ketua | Peran KETUA pada satu Squad; recruitment, Finalize, submit hasil |
| Anggota | Peran ANGGOTA pada Squad, koordinasi dan Endorsement sesuai eligibility |
| ADMIN ACTIVE | Review Mission/hasil/achievement, laporan, master data, season; tidak membaca chat |
| Akun SUSPENDED | Tidak boleh melakukan operasi mahasiswa aktif; perlakuan tiap route harus diuji |

Ketua bukan role_app baru. Seorang mahasiswa dapat menjadi Ketua di satu Squad dan anggota di Squad Mission lain. Status akun ACTIVE bukan bukti integrasi verifikasi status akademik kampus; integrasi tersebut tidak diklaim tersedia.

### 2.2 Scope MVP

Auth, onboarding, Home, Smart Profile/Edit Profil, Mission Discovery/Detail/Add Mission, Create/Apply/Recruitment Squad, My Squad, Squad Room/group chat, Finalize, Submit Mission Result, Achievement Validation, admin review, XP, Rank, Badge Chest, Seasonal Leaderboard, Endorsement, notification dan Season History. Laporan masalah Squad/Admin Intervention ditunda berdasarkan arahan ketua tim 8 Oktober 2026; fungsi tersebut belum dinyatakan selesai atau dihapus dari desain.

Keputusan 10 Oktober 2026: cleanup idle >30 hari menghapus pesan chat saja; Squad/Room tetap tersedia, hasil PENDING dikecualikan. Migration `20261010122145_cleanup_idle_squad_chat.sql` diterapkan; tes terisolasi dan runtime rollback PASS.

### 2.3 OUTSIDE MVP

AI Match; private DM; built-in video call; internal payment; availability calendar; Partner Mission berbayar/Official Partner; sertifikat Rank-Up PDF/fisik; Achievement Title Badge. Nama proposal historis Sang Pemimpin, Paling Ambis, Kolektor Kemenangan, Presisi, Rekan Terpercaya bukan seed atau backlog wajib MVP. Notifikasi H-3 cleanup masih proposal belum disetujui. Link Google Meet eksternal boleh digunakan; bukan fitur meeting internal. Administrasi dan pembayaran lomba dilakukan di luar NEXUS.

## 3. Terminologi dan navigasi

| Istilah | Definisi tunggal |
|---|---|
| Mission | Kompetisi/lomba, bukan task manajemen proyek |
| Squad | Tim untuk tepat satu Mission |
| Primary Class | Satu identitas kemampuan utama setelah onboarding |
| Skill | Kemampuan spesifik; maksimal lima per user |
| Career XP | Jumlah XP permanen dari ledger |
| Seasonal XP | XP yang ditautkan pada season terkait |
| Career Rank / Season Rank | Progression berdasarkan masing-masing jenis XP |
| Leaderboard | Urutan Seasonal XP, bukan Career XP |
| Badge Chest | Koleksi badge yang pernah diberikan |
| Endorsement | Rating antar rekan Squad selesai; tidak menghasilkan XP |
| Locked | Label UI untuk FULL atau FINALIZED, bukan enum database |

Navigasi utama Home, Missions, Leaderboard, My Squad bersifat sticky; avatar membuka Profile dari navigasi global. Home berfungsi sebagai hub, bukan satu-satunya akses fitur. My Squad menggabungkan Squad lintas-Mission dan history; Squad Room adalah ruang satu Squad. Pertahankan pattern UI yang sudah ada; PRD bukan izin redesign.

Route terkonfirmasi dalam laporan: `/missions/[missionId]`, `/onboarding`. Untuk route lain, temukan implementasi repository; jangan mengarang route baru yang bersaing dengan route existing.

## 4. Arsitektur dan batas agent

Stack: Next.js App Router, TypeScript/TSX, Supabase PostgreSQL/Auth/Storage/RLS; Realtime bila digunakan untuk Squad Chat. Jalankan development sesuai package.json, umumnya npm run dev dan localhost:3000. Versi dependency mengikuti repository; jangan upgrade framework berdasarkan asumsi.

- Default Server Component. Mission Detail tetap async Server Component; interaktivitas form menjadi Client Component kecil.
- Gunakan Supabase server/browser helper existing, bukan membuat client duplikat.
- Auth server memverifikasi user melalui pola existing; profile dicari memakai profiles.user_id = authenticated user.id, bukan profiles.id.
- Validasi client untuk feedback; Server Action untuk input/eligibility; database untuk critical integrity. Request browser dapat dimanipulasi.
- RPC diperlukan pada operasi multi-table kritis; kegagalan tidak meninggalkan data parsial.
- Jangan hardcode user ID, akun test, password, key, atau seed ID yang tidak diperiksa.
- Jangan bypass RLS, membaca chat sebagai admin, atau memindahkan pemberian XP ke client.
- Perubahan schema harus bertahap, dengan dampak data existing, backfill, rollback/recovery dan regression test dijelaskan sebelum deployment.
- Preserve dirty worktree dan file tidak terkait. Jangan rewrite foundation.

## 5. Requirement akun dan kemampuan

### AUTH-01 Registrasi dan login

Target domain STUDENT adalah `@mhs.unesa.ac.id` menurut H1/D1; domain ADMIN pada A1 adalah `@unesa.ac.id`. Pembedaan ini khusus peran, bukan izin mendaftar lintas kampus atau memilih ADMIN dari form.

Field registrasi: email mahasiswa, password, konfirmasi password, nama lengkap, NIM numerik unik, Fakultas, Program Studi, tahun masuk, persetujuan syarat. Fakultas menentukan opsi Program Studi; profile hanya menyimpan program_studi_id. Password dikelola Supabase Auth, tidak masuk tabel public. Gunakan email sebagai identitas login; label “Email UNESA” tidak berarti membuat username terpisah.

Profile 1:1 auth.users. Saat registrasi primary_class_id boleh NULL; onboarding mengisinya. accepted_terms_at wajib tersimpan sesuai kontrak aktual. role_app/status_akun tidak boleh ditentukan caller untuk menaikkan kewenangan. Konfigurasi email confirmation, reset password dan sesi mengikuti implementasi Supabase/repository; jangan mengklaim sudah diuji tanpa bukti.

A1 profiles_email_role_check masih NOT VALID: rule berlaku pada perubahan baris yang relevan, tetapi seluruh data lama belum tersertifikasi valid. Jangan menghapus/mengubah email akun existing otomatis; audit dan minta arah migrasi bila diperlukan.

### CLASS-01 Onboarding dan Edit Profil

Setelah onboarding user mempunyai tepat satu Primary Class dan paling banyak lima Skills. Tidak ada syarat minimal Skill baru yang ditetapkan PRD. Primary Class dan Skills boleh diubah kapan saja tanpa cooldown produk. Jangan mengunci Class setelah join karena itu perubahan produk baru.

| Class | Fokus | Contoh Skills dari Handbook, bukan bukti seed aktual |
|---|---|---|
| Strategist | Strategi bisnis dan pengembangan ide | Market Research, Business Analysis, Pitch Deck, BMC, Financial Planning |
| Researcher | Penelitian dan penulisan ilmiah | Essay Writing, Academic Writing, Literature Review, Data Analysis, Scientific Research |
| Technical | Teknologi dan sistem | Python, Arduino, Web Development, UI Coding, Robotics, Database |
| Creative | Visual dan media | Figma, Canva, Graphic Design, Video Editing, Motion Graphic, Photography |
| Communicator | Komunikasi dan presentasi | Public Speaking, Debate, Pitching, Negotiation, Communication Skills |

Edit Profil meliputi foto, bio, nama, Class/Skills, satu badge equipped. Identitas akademik, role dan status tidak dapat diubah lewat Edit Profil biasa sesuai guard_profile_update. Jangan menyimpulkan bahwa Skills wajib satu Class dengan profile hanya karena skills memiliki primary_class_id; aturan lintas-Class belum tegas, lihat G08.

Smart Profile menampilkan Career/Season Rank, XP/progress/milestone, Endorsement, history, Klaim Achievement dan Badge Chest. Jangan menampilkan email/NIM di profil publik.

## 6. Requirement Mission

### MIS-01 Add Mission dan review

Mahasiswa eligible dapat mengajukan Mission tanpa syarat minimum XP/Rank. Entry dari ikon tambah di Missions. Field lengkap ada di kontrak data: nama, penyelenggara/kategorinya, link resmi, kedua deadline, tahun, kategori lomba, cakupan, mode Online/Offline, gratis/berbayar, deskripsi, poster/dokumen; min/max anggota adalah tambahan PLANNED.

Alur: input → validasi deadline → saran duplikasi → PENDING → admin review → APPROVED/REJECTED. PENDING tidak masuk Discovery. Admin menentukan tier final; approval membuat Mission resmi. REJECTED memiliki alasan dan dapat diajukan ulang menggunakan submission ID sama. Tidak ada XP untuk Add Mission. Estimasi review Handbook maksimal tiga hari kerja adalah target operasional, bukan timer otomatis.

Dedup key: lower/trim nama_lomba + penyelenggara + tahun_lomba. Peringatan UI untuk kemiripan tidak membolehkan duplikat exact yang ditolak unique index. deadline_lomba tidak boleh sebelum deadline_pendaftaran. Submission kedaluwarsa harus ditolak di application/service sesuai D0; A1 guard insert belum membuktikan pengecekan waktu ini, sehingga test dibutuhkan.

### MIS-02 Discovery dan detail

Discovery hanya menampilkan Mission dengan deadline_pendaftaran > waktu sekarang. Filter: kategori (Business & Management, Research & Scientific, Technology, Creative Media, Communication), tier S/A/B/C, mode Online/Offline, Gratis/Berbayar. Pencarian Mission dan empty/error states mengikuti pola existing.

Target Detail: mahasiswa authenticated, ACTIVE dan onboarding selesai tetap dapat membuka URL Mission setelah deadline. Create Squad ditutup pada deadline <= sekarang. Jangan menghapus Mission karena deadline lewat. Squad lama tetap dapat diakses sesuai membership.

GAP AKTUAL: A1 missions_read membatasi Mission expired pada admin atau user yang mempunyai riwayat membership terkait. Maka target akses expired umum belum dianggap tercapai. Jangan melonggarkan semua RLS; perbaikan spesifik butuh task dan regression test.

Tier ditentukan admin berdasarkan kredibilitas penyelenggara dan cakupan: S internasional prestisius; A nasional kredibel; B regional/antaruniversitas; C internal kampus/komunitas. Jangan menciptakan scoring otomatis penentuan tier tanpa instruksi.

### MIS-03 Rentang peserta — PHASE 1 DEPLOYED, LEGACY G02 OPEN

Field `min_anggota_tim` dan `max_anggota_tim` sudah ada pada kedua tabel, tetapi masih nullable untuk data lama. Trigger aktif mewajibkan pasangan batas pada submission/Mission baru dan pada approval. Keduanya termasuk Ketua; lomba exact-size menggunakan min = max. Penyelesaian backfill legacy tetap menunggu G02, bukan angka tebakan.

Untuk Squad dengan batas minimum existing dua orang, domain kapasitas yang valid adalah: integer C >= 2, min_anggota_tim <= C <= max_anggota_tim. Contoh range 3–5 mengizinkan kapasitas 3,4,5 dan requirements 2,3,4. Exact-size 4 hanya mengizinkan kapasitas 4 dan requirements 3. Contoh bukan data seed.

Keputusan ketua tim 8 Oktober 2026: Mission yang dimasukkan ke NEXUS khusus lomba tim, sehingga max=1 tidak valid untuk alur Mission/Squad. Lomba individu di luar NEXUS mengikuti Klaim Achievement (VAL-02), tanpa Squad satu orang. Data Mission lama dengan max=1 tetap perlu audit/koreksi tersendiri (G02); jangan mengubahnya diam-diam.

Cakupan implementasi rentang: schema → data existing/backfill berdasarkan aturan lomba → admin approval/copy → create_squad → Server Action → UI → tests. Jangan membuat backfill angka tebakan. Perubahan batas pada Mission dengan Squad existing membutuhkan kebijakan G02.

## 7. Requirement Squad dan recruitment

### SQ-01 State dan label

| Status database | Kartu recruitment | Apply | Leave/kick oleh mahasiswa | Submit hasil |
|---|---|---|---|---|
| OPEN_RECRUITMENT | Open | Ya jika eligible | Anggota leave; Ketua kick anggota | Tidak |
| FULL | Locked | Tidak | Masih boleh sebelum Finalized | Tidak |
| FINALIZED | Locked | Tidak | Tidak; melalui Admin Intervention | Hanya Ketua |
| MISSION_COMPLETED | Tidak tampil; history | Tidak | Tidak melalui flow biasa | Tidak submit baru |
| DISBANDED | Tidak tampil; history | Tidak | Keanggotaan sudah berakhir | Tidak |

Transisi normal: create → OPEN_RECRUITMENT; penerimaan hingga kapasitas → FULL; slot kosong karena leave/kick sebelum Finalized → OPEN_RECRUITMENT; Ketua finalize dari OPEN_RECRUITMENT/FULL → FINALIZED; APPROVE hasil → MISSION_COMPLETED. Keputusan G03 (30 September 2026): Finalize tidak mensyaratkan FULL, tetapi jumlah anggota ACTIVE harus mencapai `missions.min_anggota_tim`. Jika minimum belum ditetapkan, Finalize ditahan. Lamaran PENDING tidak menghalangi Finalize dan tidak dibatalkan otomatis. Kapasitas target tidak sama dengan jumlah member saat ini.

### SQ-02 Create Squad

Eligibility: authenticated, akun ACTIVE, onboarding selesai, Mission valid, sebelum deadline, dan belum memiliki membership ACTIVE pada Mission sama.

Input: Mission ID, nama, deskripsi, kapasitas total termasuk Ketua, array requirements. Nama/deskripsi mengandung non-whitespace; C integer minimal 2; requirements tidak kosong, setiap item tepat primary_class_id dan slot_dibutuhkan, Class valid dan unik, slot integer positif. SUM(slot_dibutuhkan)=C-1. Class Ketua tidak mengurangi requirements.

RPC existing: public.create_squad(p_mission_id uuid, p_nama_squad text, p_deskripsi_squad text, p_kapasitas_anggota smallint, p_requirements jsonb) → UUID squad_id. Reuse signature aktual; perubahan signature perlu analisis compatibility.

Identitas Ketua dari auth.uid(); status awal OPEN_RECRUITMENT. Urutan atomic: insert squads → trigger squads_add_leader_after_insert memanggil after_squad_insert_add_leader → membership KETUA ACTIVE → insert squad_requirements. Jangan insert membership Ketua kedua dari action/RPC/frontend. Error harus menggagalkan seluruh operasi.

M2: SECURITY DEFINER, search_path kosong, EXECUTE ordinary app hanya authenticated; PUBLIC/anon dicabut. Direct INSERT squads/squad_requirements anon/authenticated dicabut; akses administratif terpisah tetap ada. Owner postgres dan ACL remote merupakan hasil verifikasi dilaporkan, bukan field dalam CSV.

UI inline: nama, deskripsi, kapasitas, add/remove requirement, dropdown Class dari primary_classes, slot, indikator allocated/remaining, error terbaca, pending dan pencegah submit ganda. Server Action existing dipakai; refresh list setelah keberhasilan. Jangan menandai sukses sebelum RPC berhasil. Error aman tidak memuat credential/internal stack. Reset/tutup form dan card baru termasuk test pending.

Kapasitas minimal dan total requirements kuat pada jalur CREATE RPC; bukan otomatis invariant semua UPDATE. Menambah fitur Edit Squad harus menjaga kapasitas >= anggota aktif, konsistensi slots, batas Mission, dan locking; strategi perubahan adalah bagian task tersebut, bukan izin menulis sekarang.

### SQ-03 Apply, accept, reject, cancel

Satu user: maksimal tiga PENDING applications per Mission, satu PENDING per Squad, satu membership ACTIVE per Mission. Apply bukan langsung join. Ketua menilai pelamar; acceptance atomic memasukkan anggota, menetapkan ACCEPTED, membatalkan PENDING lain user pada Mission sama, dan memperbarui FULL jika penuh. Reject mempunyai outcome tersendiri; applicant dapat cancel PENDING.

Gunakan function existing decide_squad_application/cancel_squad_application dan guard yang tersedia, bukan duplicate write path. Ketika membership ACTIVE berkonflik, transaksi gagal tanpa data parsial. Uji request bersamaan.

Keputusan ketua tim 8 Oktober 2026: kebutuhan Class/Skill Squad wajib diisi sesuai field yang didukung, tetapi kecocokan pelamar menjadi informasi bagi Ketua, bukan syarat otomatis accept/reject. Ketua boleh menerima pelamar yang tidak cocok; jangan menambahkan penolakan otomatis berdasarkan Class/Skill. Pengisian Skill tambahan pada Create tetap mengikuti UI-G02 karena RPC saat ini hanya menyimpan kebutuhan Primary Class dan slot. Keputusan pemilik 12 Oktober 2026 (G05): Create Squad membatalkan semua application PENDING milik pembuat pada Mission yang sama, secara atomic bersama pembuatan Squad, membership Ketua dan requirements. Application pada Mission lain dan milik user lain tetap utuh. Jika Create gagal, seluruh perubahan rollback. Jalur Create/submit/decide/cancel memakai advisory lock per applicant yang sama.

### SQ-04 Leave, kick, finalize, My Squad

Anggota bisa leave sebelum Finalized. Ketua bisa kick anggota sebelum Finalized. Gunakan ended_at, removed_by/reason sesuai state; jangan hapus riwayat membership untuk berpindah tim. Keputusan pemilik 12 Oktober 2026 (G06): sebelum Finalized, Ketua mentransfer kepemimpinan kepada ANGGOTA ACTIVE dengan akun STUDENT ACTIVE melalui transfer_squad_leadership. Ketua lama tetap menjadi ANGGOTA ACTIVE dan boleh menggunakan leave_squad setelah transfer berhasil. Pergantian ketua_id dan kedua role atomic; riwayat membership tetap dipertahankan. Ketua tidak dapat leave langsung. Keputusan pemilik 13 Oktober 2026 (G06): Ketua yang merupakan satu-satunya anggota ACTIVE boleh membubarkan Squad sebelum FINALIZED melalui disband_solo_squad. Status DISBANDED, disbanded_at/disbanded_by dan membership LEFT/ended_at disimpan atomic; semua PENDING pada Squad itu CANCELLED dan pelamar mendapat notifikasi. Tidak ada auto-disband. Riwayat, requirements dan chat tetap tersimpan, Room/chat/recruitment ditutup; Ketua dapat create/join lagi mengikuti eligibility Mission existing. Anggota lain mewajibkan transfer bila Ketua ingin keluar. Setelah Finalized perlu admin intervention. My Squad menampilkan aktif dan history lintas-Mission; detail memuat anggota, chat, dan aksi yang diizinkan.

## 8. Validasi prestasi dan XP

### VAL-01 Mission Result

Ketua FINALIZED mengisi hasil, tier yang diajukan, sertifikat tim dan dokumen pendukung opsional. Sistem menghitung preview XP, bukan menerima angka bebas client. PENDING tampil untuk anggota terkait. Admin memeriksa bukti, menetapkan approved tier dan hasil, lalu APPROVE/REJECT. Penolakan memerlukan alasan; resubmit memakai record yang sama, bukan membuat dua hasil per Squad.

Keputusan implementasi review (1 Oktober 2026): hasil pengajuan tetap di `hasil_kompetisi`, sedangkan keputusan admin disimpan terpisah di `approved_hasil_kompetisi`. Record APPROVED sebelum perubahan ini boleh bernilai NULL pada kolom baru; pembacaan data lama menggunakan hasil pengajuan sebagai hasil final. Review hanya dari PENDING pada Squad FINALIZED; alasan penolakan wajib, dan XP final diturunkan dari tier serta hasil yang disetujui oleh database.

APPROVE harus konsisten dalam satu transaksi: credit XP sama untuk seluruh membership ACTIVE → Squad MISSION_COMPLETED → hapus chat → notification. ADMIN_REMOVED tidak ACTIVE, tidak menerima XP. Approval tidak membagi nilai XP dengan jumlah member. Data APPROVED tidak diedit bebas; source guards dan unique ledger mencegah double credit.

### VAL-02 Achievement Validation

Klaim dari Profile untuk sertifikat lama, lomba individu/di luar Squad NEXUS. Input nama, penyelenggara, achievement_date lengkap, tier, hasil, sertifikat. Tahun saja tidak cukup untuk season Juli–Juni. Legacy XP adalah 50% Verified setelah disetujui admin; transaksi yang ditautkan ke season terkait ikut Seasonal XP, selain itu tetap Career XP (XP-01). Bukti klaim PDF/JPG/PNG maksimal 5.000.000 byte per file, disimpan di Storage privat; database menyimpan path, bukan isi file (FILE-01). Admin review visual; reject dengan alasan; resubmit pada claim ID yang sama. Manipulasi bukti dapat berujung suspend melalui keputusan admin.

### XP-01 Ledger, tanggal, dan season

xp_transactions adalah source of truth; jumlah positif, tepat satu sumber FK, sumber APPROVED, nilai sama approved_xp, penerima sesuai sumber. Tidak ada XP dari Add Mission, chat, login, Endorsement, atau client arbitrary.

Career XP = semua transaksi user. Seasonal XP = transaksi dengan season_id terkait. Snapshot A1 menautkan transaksi hanya ke season ACTIVE yang mencakup earned_at; di luar itu season_id NULL, tetap Career. Verified earned_at memakai deadline_lomba::date sesuai komentar after_mission_result_review; Legacy memakai achievement_date. Jangan ganti menjadi tanggal approve tanpa keputusan. Keputusan 10 Oktober 2026 (G10): timezone bisnis Asia/Jakarta; approval setelah akhir periode atau setelah Season CLOSED menerima Career XP saja (`season_id NULL`), bukan Seasonal XP lama maupun baru. Snapshot CLOSED tetap. Verified earned_at memakai tanggal deadline_lomba dalam WIB; Legacy tetap achievement_date. Review dan closure harus diserialisasi; gunakan waktu review setelah lock untuk seluruh anggota. Migration `20261010114514_automate_season_rollover_and_weekly_badges.sql` diterapkan; tes terisolasi dan runtime rollback PASS. Scheduler rollover 5 menit dan badge Senin 00.00 WIB aktif.

Reset season bukan DELETE transaksi: season ditutup, history disimpan, tampilan berpindah season. Hanya satu ACTIVE season. Jangan menulis XP dari client atau menghapus ledger untuk memperbaiki tampilan.

### XP-02 Tabel reward normatif (seed harus diverifikasi)

| Verified XP | Participant | Finalist | Juara 3 | Juara 2 | Juara 1 |
|---|---:|---:|---:|---:|---:|
| S | 230 | 400 | 550 | 700 | 900 |
| A | 150 | 250 | 350 | 450 | 600 |
| B | 80 | 150 | 220 | 300 | 400 |
| C | 40 | 80 | 120 | 170 | 250 |

| Legacy XP | Participant | Finalist | Juara 3 | Juara 2 | Juara 1 |
|---|---:|---:|---:|---:|---:|
| S | 115 | 200 | 275 | 350 | 450 |
| A | 75 | 125 | 175 | 225 | 300 |
| B | 40 | 75 | 110 | 150 | 200 |
| C | 20 | 40 | 60 | 85 | 125 |

Participant berarti berpartisipasi tanpa final; Finalist berarti final tanpa juara. Reward diambil dari xp_rules saat validasi sesuai tier/hasil, bukan hardcode di beberapa komponen.

## 9. Rank, Leaderboard, Badge dan Endorsement

### RANK-01 Progression

| Rank | XP inklusif |
|---|---|
| Bronze | 0–299 |
| Silver | 300–999 |
| Gold | 1000–2499 |
| Platinum | 2500–5999 |
| Diamond | >=6000 |

Silver I=300, II=600, III=999. Rank-Up Reward diterbitkan saat melewati threshold Career/Seasonal, termasuk seluruh milestone yang dilompati dalam satu kredit. Badge masuk Chest dan notification; popup memakai icon tier existing, bukan asset generik baru. Angka tabel merupakan target H0/D0; A1 bukan dump seed.

### LB-01 Ranking dan history

Scope PROGRAM_STUDI, FAKULTAS, UNIVERSITAS/seluruh UNESA. Basis Seasonal XP. Urutan: seasonal_xp DESC → waktu lebih awal mencapai total akhir ASC → user_id deterministic. Snapshot close_active_season memakai max(created_at) transaksi season untuk reached_at. Definisi view live belum tersedia dalam inventaris, harus diperiksa sebelum menilai kesesuaiannya.

Search nama berjalan dalam scope aktif, menyorot posisi tanpa mengubah ranking populasi. Card membuka profile. Keputusan 8 Oktober 2026: populasi live adalah seluruh profil STUDENT berstatus akun ACTIVE dalam scope, termasuk yang memiliki 0 Seasonal XP. ADMIN dan SUSPENDED dikecualikan. ACTIVE adalah status akun NEXUS, bukan verifikasi status akademik kampus. Pembaruan 10 Oktober 2026: migration `20261010031408_align_season_leaderboard_population.sql` menyelaraskan snapshot `close_active_season` dan view internal sumber `refresh_leaderboard_badges` dengan populasi STUDENT ACTIVE (termasuk 0 XP). Runtime rollback memverifikasi kesamaan ranking tiga scope, exclusion admin/suspended, award idempotent, snapshot dan ledger tetap utuh. Scheduler dan kasus approval bersamaan/terlambat masih belum selesai (G09/G10).

Season Juli–Juni. Saat ditutup: simpan Season Rank, Seasonal XP dan posisi/populasi per scope; Career dan badge lama tidak hilang. Function close_active_season tersedia di snapshot, scheduler dan pembukaan season berikutnya belum terbukti.

### BADGE-01 Pemberian dan equip

Dua tipe MVP: RANK_UP, LEADERBOARD_POSITION. Rank-Up pada kredit XP; ranking bisa mengikuti XP, sedangkan pemberian badge posisi ditargetkan refresh mingguan. Ini bukan aturan semua badge menunggu mingguan.

| Posisi | Badge |
|---|---|
| #1 | Champion |
| #2 | Runner-up |
| #3 | Third |
| Posisi >3, persentil 3–10% | Contender |

Snapshot refresh_leaderboard_badges menerapkan rasio rank/population >0.03 dan <=0.10. Batas bawah exact 3% dalam redaksi Handbook ambigu; jangan mengubah algoritma tanpa keputusan G09. Tidak ada minimum XP untuk badge yang ditetapkan source.

Semua badge yang pernah diberikan tetap di Chest; hanya satu equipped, termasuk badge season lama. Unik peringkat saat perhitungan tidak berarti hanya satu orang sepanjang sejarah boleh menyimpan Champion. Snapshot award bersifat menambah, bukan mencabut badge historis. Ketika owner posisi berubah antarminggu, bedakan current ranking dan historical reward; G09 mengatur detail penyajian yang belum tegas. Contender tampil dengan konteks “Contender · #54 dari 1.200”, bukan nomor tanpa populasi.

### END-01 Endorsement

Alur utama My Squad → Riwayat Squad completed → Detail Squad → Nilai rekan → profile rekan dengan konteks Squad terpilih. Leaderboard → profile tetap jalur tambahan; posisi/perolehan XP bukan syarat Endorsement. Keputusan pengguna 15 Oktober 2026: pemberi dan penerima harus menjadi anggota saat Squad difinalisasi, lalu Squad berstatus MISSION_COMPLETED setelah approval hasil. Riwayat bergabung sebelum finalisasi saja tidak mencukupi. Keputusan pengguna 15 Oktober 2026: pengajuan baru hanya selama 14 x 24 jam sejak hasil disetujui admin, memakai `squads.completed_at` yang ditulis approval. Awal inklusif, akhir eksklusif; timestamp kosong/future ditolak. Form menampilkan batas dalam WIB dan menutup pilihan kedaluwarsa; database memeriksa waktu sebenarnya pada INSERT. Penilaian existing tetap terlihat sesudah jendela tutup. Empat nilai integer 1–5: communication, contribution, teamwork, responsibility. Tidak self-endorse; satu per pasangan arah pemberi-penerima per Squad; tanpa ulasan teks panjang. Ringkasan rata-rata/bintang ditampilkan, tidak mengubah XP/Rank.

Koreksi aturan oleh pengguna 15 Oktober 2026: daftar tim final dan eligibility memakai interval `joined_at <= finalized_at` serta `ended_at IS NULL OR ended_at > finalized_at`. Keluar/kick sebelum atau tepat saat finalisasi dan join setelah finalisasi tidak eligible. Anggota yang dikeluarkan sesudah finalisasi tetap bagian tim final, sehingga status ACTIVE saat ini bukan pengganti interval tersebut. View `finalized_squad_members` dengan security_invoker menyatukan pembacaan UI/action dan guard INSERT; `finalized_at` hanya diubah jalur internal finalisasi. History membership dan rating existing tetap tersimpan; XP tetap mengikuti kebijakan approval existing.

## 10. Chat, Admin Intervention, notification, storage

### CHAT-01 Akses dan retensi

Group chat tersedia setelah Squad terbentuk, tidak harus menunggu Finalized. Hanya akun eligible dengan membership ACTIVE bisa membaca/mengirim sebelum Mission Completed. Policy menolak admin aplikasi, bukan jaminan bahwa operator postgres/service_role tidak mempunyai akses infrastruktur. Tidak ada private DM/video call. Setelah approval mengubah Squad menjadi MISSION_COMPLETED, pesan dihapus.

Realtime adalah transport pembaruan, bukan pengganti RLS. Verifikasi publication, subscription authorization, keluar/removed member dan channel cleanup saat logout. Kolom/function yang ada tidak membuktikan Realtime aktif.

### ADM-01 Intervention

DITUNDA berdasarkan arahan ketua tim 8 Oktober 2026; tidak dibangun pada tahap sekarang. Jika dilanjutkan nanti, target awalnya: anggota ACTIVE pada Squad FINALIZED dapat melapor dengan jenis masalah, pihak terlibat opsional, dan deskripsi. Status RECEIVED → REVIEWING → COMPLETED. Admin mencatat tindakan, handler dan waktu selesai. Data permintaan dan laporan selesai dilindungi dari edit bebas. Target respons 3–5 hari kerja, bukan klaim otomatis.

Tindakan target: remove member, membubarkan Squad, atau membuka recruitment lagi. kick_squad_member mendukung ADMIN_REMOVED; workflow pembubaran/reopen harus diperiksa dan didefinisikan agar tidak menghapus hasil/ledger/history secara tidak sengaja (G07). Tidak memberi akses chat. Member yang dikeluarkan sebelum approval tidak menerima XP.

### OPS-01 Cleanup dan notification

Keputusan pengguna 10 Oktober 2026 (G07): idle lebih dari 30 x 24 jam dihitung dari chat baru, perubahan Squad/recruitment/requirements/anggota, finalize, serta submit/resubmit/review hasil. Cleanup hanya menghapus pesan; Squad Room tetap dapat dipakai dan Squad, membership, hasil, XP, badge, Endorsement serta history tetap. Hasil PENDING melindungi Squad dari cleanup. Job berjalan setiap hari 02.00 WIB, memakai row lock/recheck serta SKIP LOCKED. Timestamp-only/no-op dan penghapusan chat tidak dihitung aktivitas. Backfill memperhitungkan timestamp aktivitas lama yang tersedia. H-3 tetap proposal.

Notification untuk hasil validasi, Rank-Up, hasil recruitment dan update laporan. User hanya mengubah is_read, bukan isi/penerima. Penyampaian notification setiap event harus diuji; keberadaan tabel tidak cukup.

### FILE-01 File dan privasi

Simpan file di Supabase Storage, database menyimpan path. Poster/dokumen Add Mission menurut Handbook PDF/PNG/JPG. Jenis dan batas ukuran sertifikat/foto, bucket, retention dan signed URL perlu mengikuti keputusan/config existing, tidak diarang. Authorization upload/download/delete harus konsisten dengan pemilik/admin reviewer; jangan membuat seluruh bucket publik untuk mengatasi error. Jangan memasukkan data mahasiswa, credential, token, atau signed URL ke log, fixture permanen, maupun laporan.

## 11. Kontrak data lengkap

Bagian berikut mengonsolidasikan 28 entitas D0/D1; nama kolom dipertahankan agar agent tidak menciptakan alias. Ini kontrak desain, bukan DDL siap deploy. Nullable/default yang tidak ditulis harus dicek pada schema aktual; jangan menambahkan NOT NULL otomatis. Field min/max Mission ditandai PLANNED dan tidak boleh di-query sebelum migration terverifikasi. Seed adalah target, bukan bukti data tersedia.

### DATA-1 `profiles`
NEXUS profile linked 1:1 to Supabase Auth.

| Column | Type | Rule |
|---|---|---|
| `user_id` | UUID | PK, FK → `auth.users.id` |
| `email_unesa` | TEXT | UNIQUE; STUDENT: @mhs.unesa.ac.id; ADMIN: @unesa.ac.id menurut A1. Lihat AUTH-01. |
| `nim` | TEXT | UNIQUE, digits only |
| `nama_lengkap` | TEXT | required |
| `tahun_masuk` | SMALLINT | required |
| `program_studi_id` | BIGINT | FK → `program_studi` |
| `primary_class_id` | BIGINT | FK → `primary_classes`; nullable sebelum onboarding, wajib diisi setelah onboarding |
| `bio` | TEXT | optional |
| `foto_profil_path` | TEXT | optional |
| `role_app` | ENUM | `STUDENT` / `ADMIN` |
| `status_akun` | ENUM | `ACTIVE` / `SUSPENDED` |
| `accepted_terms_at` | TIMESTAMPTZ | required for completed registration |
| `created_at` | TIMESTAMPTZ | default now |
| `updated_at` | TIMESTAMPTZ | default now |

> `fakultas_id` is intentionally not duplicated in `profiles`; it is derived through `program_studi` to prevent Fakultas/Prodi mismatch.

### DATA-2 `fakultas`

| Column | Type | Rule |
|---|---|---|
| `fakultas_id` | BIGINT | PK |
| `nama_fakultas` | TEXT | UNIQUE |
| `kode_fakultas` | TEXT | UNIQUE |

### DATA-3 `program_studi`

| Column | Type | Rule |
|---|---|---|
| `program_studi_id` | BIGINT | PK |
| `fakultas_id` | BIGINT | FK → `fakultas` |
| `nama_program_studi` | TEXT | required |
| `kode_program_studi` | TEXT | UNIQUE |

Relationship: `fakultas 1 ── N program_studi`.

### DATA-4 `primary_classes`

| Column | Type | Rule |
|---|---|---|
| `primary_class_id` | BIGINT | PK |
| `nama_class` | TEXT | UNIQUE |
| `deskripsi` | TEXT | optional |

Seed: Strategist, Researcher, Technical, Creative, Communicator.

### DATA-5 `skills`

| Column | Type | Rule |
|---|---|---|
| `skill_id` | BIGINT | PK |
| `primary_class_id` | BIGINT | FK → `primary_classes` |
| `nama_skill` | TEXT | required |
| `deskripsi` | TEXT | optional |

Unique: `(primary_class_id, nama_skill)`.

### DATA-6 `user_skills`

| Column | Type | Rule |
|---|---|---|
| `user_skill_id` | UUID | PK |
| `user_id` | UUID | FK → `profiles` |
| `skill_id` | BIGINT | FK → `skills` |
| `created_at` | TIMESTAMPTZ | default now |

Unique: `(user_id, skill_id)`.
Database trigger: maximum **5 skills per user**.

---


### DATA-7 `mission_tiers`

| Column | Type | Rule |
|---|---|---|
| `tier_id` | BIGINT | PK |
| `kode_tier` | TEXT | UNIQUE (`S`, `A`, `B`, `C`) |
| `nama_tier` | TEXT | required |
| `deskripsi` | TEXT | optional |

### DATA-8 `mission_submissions`
Stores Add Mission requests before approval.

| Column | Type |
|---|---|
| `mission_submission_id` | UUID PK |
| `submitted_by` | UUID FK → profiles |
| `nama_lomba` | TEXT |
| `penyelenggara` | TEXT |
| `kategori_penyelenggara` | ENUM |
| `link_resmi` | TEXT |
| `deadline_pendaftaran` | TIMESTAMPTZ |
| `deadline_lomba` | TIMESTAMPTZ |
| `tahun_lomba` | SMALLINT |
| `kategori_lomba` | ENUM |
| `cakupan_peserta` | ENUM |
| `mode_lomba` | ENUM |
| `min_anggota_tim` | SMALLINT — deployed, nullable pada legacy; wajib untuk pengajuan baru |
| `max_anggota_tim` | SMALLINT — deployed, nullable pada legacy; wajib untuk pengajuan baru |
| `biaya_pendaftaran` | ENUM |
| `deskripsi_singkat` | TEXT |
| `dokumen_path` | TEXT |
| `suggested_tier_id` | BIGINT FK → mission_tiers, optional |
| `final_tier_id` | BIGINT FK → mission_tiers, optional |
| `status_review` | ENUM (`PENDING`, `APPROVED`, `REJECTED`) |
| `alasan_penolakan` | TEXT optional |
| `reviewed_by` | UUID FK → profiles, optional |
| `submitted_at` | TIMESTAMPTZ |
| `reviewed_at` | TIMESTAMPTZ optional |
| `resubmission_count` | INTEGER |

Implementation rule: rejected submissions are edited/resubmitted using the **same submission ID**.

> `mode_lomba` is included because Mission Discovery has Online/Offline filtering, even though REV6's Add Mission field list does not explicitly list the mode field.
>
> **Working decision — pending implementation:** Add Mission must also record the minimum and maximum number of team participants. Both values include the Squad leader, must be positive, and must satisfy `min_anggota_tim <= max_anggota_tim`. An exact-size competition uses equal minimum and maximum values.

### DATA-9 `missions`
Approved mission data shown in Discovery.

| Column | Type |
|---|---|
| `mission_id` | UUID PK |
| `source_submission_id` | UUID FK → mission_submissions, optional |
| `tier_id` | BIGINT FK → mission_tiers |
| `nama_lomba` | TEXT |
| `penyelenggara` | TEXT |
| `kategori_penyelenggara` | ENUM |
| `link_resmi` | TEXT |
| `deadline_pendaftaran` | TIMESTAMPTZ |
| `deadline_lomba` | TIMESTAMPTZ |
| `tahun_lomba` | SMALLINT |
| `kategori_lomba` | ENUM |
| `cakupan_peserta` | ENUM |
| `mode_lomba` | ENUM |
| `min_anggota_tim` | SMALLINT — deployed, nullable pada legacy; wajib untuk Mission baru |
| `max_anggota_tim` | SMALLINT — deployed, nullable pada legacy; wajib untuk Mission baru |
| `biaya_pendaftaran` | ENUM |
| `deskripsi_singkat` | TEXT |
| `dokumen_path` | TEXT |
| `created_at` | TIMESTAMPTZ |

Deduplication key: normalized `nama_lomba + penyelenggara + tahun_lomba`.

Discovery rule: mission is shown only while `deadline_pendaftaran` has not passed.

**Planned capacity authority:** after the Mission capacity migration is implemented, `missions.min_anggota_tim` and `missions.max_anggota_tim` become the authoritative range for every Squad created for that Mission. This validation must exist in the database/RPC as well as the Server Action and UI.

---


### DATA-10 `squads`

| Column | Type |
|---|---|
| `squad_id` | UUID PK |
| `mission_id` | UUID FK → missions |
| `ketua_id` | UUID FK → profiles |
| `nama_squad` | TEXT |
| `deskripsi_squad` | TEXT |
| `kapasitas_anggota` | SMALLINT |
| `status_squad` | ENUM (`OPEN_RECRUITMENT`, `FULL`, `FINALIZED`, `MISSION_COMPLETED`, `DISBANDED`) |
| `last_activity_at` | TIMESTAMPTZ |
| `created_at` | TIMESTAMPTZ |
| `finalized_at` | TIMESTAMPTZ optional |
| `completed_at` | TIMESTAMPTZ optional |
| `disbanded_at` | TIMESTAMPTZ optional; diwajibkan pada DISBANDED (13 Oktober) |
| `disbanded_by` | UUID FK → profiles optional; Ketua yang membubarkan (13 Oktober) |

`(squad_id, mission_id)` has a unique constraint so child tables can enforce Mission consistency.

Current Create Squad rules:
- `kapasitas_anggota` is the total number of participants, including the `KETUA`;
- minimum capacity is 2;
- capacity must later be constrained by the Mission's planned minimum/maximum team size;
- the initial status is explicitly `OPEN_RECRUITMENT`;
- name and description must contain at least one non-whitespace character.

### DATA-11 `squad_requirements`

| Column | Type |
|---|---|
| `requirement_id` | UUID PK |
| `squad_id` | UUID FK → squads |
| `primary_class_id` | BIGINT FK → primary_classes |
| `slot_dibutuhkan` | SMALLINT |

Unique: `(squad_id, primary_class_id)`.

Create Squad requirement rules:
- at least one requirement is required;
- requirements represent recruitment slots outside the `KETUA`;
- total `slot_dibutuhkan` must equal `kapasitas_anggota - 1`;
- the leader's Primary Class does not reduce a requirement;
- each Primary Class must exist, must be unique within the Squad, and each slot must be a positive integer.

### DATA-12 `squad_members`

| Column | Type |
|---|---|
| `squad_member_id` | UUID PK |
| `squad_id` | UUID |
| `mission_id` | UUID |
| `user_id` | UUID FK → profiles |
| `role_squad` | ENUM (`KETUA`, `ANGGOTA`) |
| `status_member` | ENUM (`ACTIVE`, `LEFT`, `KICKED`, `ADMIN_REMOVED`) |
| `joined_at` | TIMESTAMPTZ |
| `ended_at` | TIMESTAMPTZ optional |
| `removed_by` | UUID FK → profiles, optional |
| `removal_reason` | TEXT optional |

Composite FK: `(squad_id, mission_id) → squads(squad_id, mission_id)`.

Critical rule: partial UNIQUE `(user_id, mission_id)` where `status_member = ACTIVE`.
This enforces **one active Squad per user per Mission**, while still allowing a user who left before Finalized to join another Squad on the same Mission.

### DATA-13 `squad_applications`

| Column | Type |
|---|---|
| `application_id` | UUID PK |
| `squad_id` | UUID |
| `mission_id` | UUID |
| `user_id` | UUID FK → profiles |
| `status_application` | ENUM (`PENDING`, `ACCEPTED`, `REJECTED`, `CANCELLED`) |
| `created_at` | TIMESTAMPTZ |
| `decided_at` | TIMESTAMPTZ optional |
| `decided_by` | UUID FK → profiles, optional |

Unique active application per squad/user.
Database trigger: maximum **3 PENDING applications per user per Mission**.
Acceptance transaction must:
1. insert/activate membership;
2. mark accepted application as `ACCEPTED`;
3. automatically mark the user's other PENDING applications for that Mission as `CANCELLED`.

### DATA-14 `squad_messages`

| Column | Type |
|---|---|
| `message_id` | UUID PK |
| `squad_id` | UUID FK → squads |
| `sender_id` | UUID FK → profiles |
| `content` | TEXT |
| `created_at` | TIMESTAMPTZ |

Rules:
- Only ACTIVE Squad members can read/send.
- Application admins must not have chat read access.
- Messages are deleted after Result approval changes Squad to Mission Completed.

### DATA-15 `mission_result_submissions`

| Column | Type |
|---|---|
| `result_submission_id` | UUID PK |
| `squad_id` | UUID FK → squads, UNIQUE |
| `submitted_by` | UUID FK → profiles |
| `hasil_kompetisi` | ENUM (`PARTICIPANT`, `FINALIST`, `JUARA_3`, `JUARA_2`, `JUARA_1`) |
| `submitted_tier_id` | BIGINT FK → mission_tiers |
| `approved_tier_id` | BIGINT FK → mission_tiers, optional |
| `sertifikat_path` | TEXT |
| `dokumen_pendukung_path` | TEXT optional |
| `preview_xp` | INTEGER |
| `approved_xp` | INTEGER optional |
| `status_validation` | ENUM (`PENDING`, `APPROVED`, `REJECTED`) |
| `rejection_reason` | TEXT optional |
| `submitted_at` | TIMESTAMPTZ |
| `reviewed_by` | UUID FK → profiles, optional |
| `reviewed_at` | TIMESTAMPTZ optional |

Critical rule: only Squad leader and only when `status_squad = FINALIZED` may submit.

---


### DATA-16 `achievement_claims`

| Column | Type |
|---|---|
| `achievement_claim_id` | UUID PK |
| `user_id` | UUID FK → profiles |
| `nama_kompetisi` | TEXT |
| `penyelenggara` | TEXT |
| `achievement_date` | DATE |
| `submitted_tier_id` | BIGINT FK → mission_tiers |
| `approved_tier_id` | BIGINT FK → mission_tiers, optional |
| `hasil_kompetisi` | ENUM |
| `sertifikat_path` | TEXT |
| `preview_xp` | INTEGER |
| `approved_xp` | INTEGER optional |
| `status_validation` | ENUM |
| `rejection_reason` | TEXT optional |
| `submitted_at` | TIMESTAMPTZ |
| `reviewed_by` | UUID FK → profiles, optional |
| `reviewed_at` | TIMESTAMPTZ optional |
| `resubmission_count` | INTEGER |

**Technical addition:** `achievement_date` is stored, not only `year`, because Seasonal XP uses an academic season running July–June; a year alone cannot reliably determine the season.

V1 implementation decision: rejected claims are resubmitted using the same claim ID.

---


### DATA-17 `seasons`

| Column | Type |
|---|---|
| `season_id` | UUID PK |
| `nama_season` | TEXT UNIQUE |
| `start_date` | DATE |
| `end_date` | DATE |
| `status_season` | ENUM (`UPCOMING`, `ACTIVE`, `CLOSED`) |

Only one season may be ACTIVE.

### DATA-18 `xp_rules`
The handbook XP table represented as data.

| Column | Type |
|---|---|
| `xp_rule_id` | BIGINT PK |
| `tier_id` | BIGINT FK → mission_tiers |
| `hasil_kompetisi` | ENUM |
| `verified_xp` | INTEGER |
| `legacy_xp` | INTEGER |

Unique: `(tier_id, hasil_kompetisi)`.

### DATA-19 `xp_transactions`
Source-of-truth XP ledger.

| Column | Type |
|---|---|
| `xp_transaction_id` | UUID PK |
| `user_id` | UUID FK → profiles |
| `xp_amount` | INTEGER > 0 |
| `xp_source_type` | ENUM (`VERIFIED_MISSION`, `LEGACY_ACHIEVEMENT`) |
| `mission_result_submission_id` | UUID FK, optional |
| `achievement_claim_id` | UUID FK, optional |
| `season_id` | UUID FK → seasons, optional |
| `earned_at` | DATE |
| `created_at` | TIMESTAMPTZ |

Exactly one source FK must be present.

Career XP = `SUM(xp_transactions.xp_amount)` for the user.
Seasonal XP = SUM only transactions assigned to the relevant `season_id`.

Duplicate prevention:
- one Verified Mission XP transaction per user per approved result;
- one Legacy XP transaction per user per approved achievement claim.

### DATA-20 `rank_rules`

| Column | Type |
|---|---|
| `rank_rule_id` | BIGINT PK |
| `rank_name` | TEXT UNIQUE |
| `min_xp` | INTEGER |
| `max_xp` | INTEGER optional |
| `display_order` | SMALLINT |

Seed:
- Bronze: 0–299
- Silver: 300–999
- Gold: 1000–2499
- Platinum: 2500–5999
- Diamond: 6000+

### DATA-21 `rank_milestones`

| Column | Type |
|---|---|
| `milestone_id` | BIGINT PK |
| `milestone_code` | TEXT UNIQUE |
| `xp_threshold` | INTEGER |
| `label` | TEXT |

Seed includes Silver I (300), Silver II (600), Silver III (999), plus rank thresholds used for Rank-Up rewards.

### DATA-22 `season_user_history`
Snapshot when a season closes.

| Column | Type |
|---|---|
| `season_user_history_id` | UUID PK |
| `season_id` | UUID FK |
| `user_id` | UUID FK |
| `seasonal_xp` | INTEGER |
| `season_rank_name` | TEXT |
| `snapshot_at` | TIMESTAMPTZ |

Unique: `(season_id, user_id)`.

### DATA-23 `season_leaderboard_history`
Final per-scope leaderboard snapshot.

| Column | Type |
|---|---|
| `history_id` | UUID PK |
| `season_id` | UUID FK |
| `user_id` | UUID FK |
| `scope_type` | ENUM (`PROGRAM_STUDI`, `FAKULTAS`, `UNIVERSITAS`) |
| `program_studi_id` | BIGINT optional |
| `fakultas_id` | BIGINT optional |
| `rank_position` | INTEGER |
| `population_total` | INTEGER |
| `seasonal_xp` | INTEGER |
| `snapshot_at` | TIMESTAMPTZ |

---


### DATA-24 `badge_definitions`

| Column | Type |
|---|---|
| `badge_id` | BIGINT PK |
| `badge_code` | TEXT UNIQUE |
| `badge_name` | TEXT |
| `badge_type` | ENUM (`RANK_UP`, `LEADERBOARD_POSITION`) |
| `asset_path` | TEXT optional |
| `description` | TEXT optional |

Achievement Title Badges are intentionally not seeded in MVP.

### DATA-25 `user_badges`

| Column | Type |
|---|---|
| `user_badge_id` | UUID PK |
| `user_id` | UUID FK |
| `badge_id` | BIGINT FK |
| `season_id` | UUID FK optional |
| `reward_context` | ENUM (`CAREER`, `SEASONAL`, `LEADERBOARD`) |
| `scope_type` | ENUM optional |
| `program_studi_id` | BIGINT optional |
| `fakultas_id` | BIGINT optional |
| `rank_position` | INTEGER optional |
| `population_total` | INTEGER optional |
| `is_equipped` | BOOLEAN |
| `awarded_at` | TIMESTAMPTZ |

Partial UNIQUE: only one row per user may have `is_equipped = true`.

---


### DATA-26 `endorsements`

| Column | Type |
|---|---|
| `endorsement_id` | UUID PK |
| `squad_id` | UUID FK |
| `from_user_id` | UUID FK |
| `to_user_id` | UUID FK |
| `communication` | SMALLINT CHECK 1–5 |
| `contribution` | SMALLINT CHECK 1–5 |
| `teamwork` | SMALLINT CHECK 1–5 |
| `responsibility` | SMALLINT CHECK 1–5 |
| `created_at` | TIMESTAMPTZ |

Unique: `(squad_id, from_user_id, to_user_id)`.
Check: `from_user_id <> to_user_id`.
Business rule (15 October 2026): both users must be members at Squad finalization, the Squad must be Mission Completed, and new ratings must be within 336 hours of completed_at.

### DATA-27 `admin_reports`

| Column | Type |
|---|---|
| `report_id` | UUID PK |
| `squad_id` | UUID FK |
| `reporter_id` | UUID FK |
| `involved_user_id` | UUID FK optional |
| `issue_type` | TEXT |
| `description` | TEXT |
| `status_report` | ENUM (`RECEIVED`, `REVIEWING`, `COMPLETED`) |
| `admin_action` | TEXT optional |
| `handled_by` | UUID FK optional |
| `created_at` | TIMESTAMPTZ |
| `completed_at` | TIMESTAMPTZ optional |

Admin report handling must not grant chat access.

### DATA-28 `notifications`

| Column | Type |
|---|---|
| `notification_id` | UUID PK |
| `user_id` | UUID FK |
| `notification_type` | TEXT |
| `title` | TEXT |
| `body` | TEXT |
| `is_read` | BOOLEAN |
| `created_at` | TIMESTAMPTZ |

Used for validation results, Rank-Up rewards, recruitment outcomes, admin report updates, etc.

### DATA-29 Pemetaan enum aktual (A1)

Gunakan literal enum ini, bukan label UI atau ejaan terjemahan sebagai nilai database. Ini daftar enum existing, bukan perintah membuat ulang enum.

| Enum | Nilai |
|---|---|
| role_app_enum | STUDENT, ADMIN |
| status_akun_enum | ACTIVE, SUSPENDED |
| squad_role_enum | KETUA, ANGGOTA |
| squad_status_enum | OPEN_RECRUITMENT, FULL, FINALIZED, MISSION_COMPLETED, DISBANDED |
| member_status_enum | ACTIVE, LEFT, KICKED, ADMIN_REMOVED |
| application_status_enum | PENDING, ACCEPTED, REJECTED, CANCELLED |
| review_status_enum | PENDING, APPROVED, REJECTED |
| validation_status_enum | PENDING, APPROVED, REJECTED |
| report_status_enum | RECEIVED, REVIEWING, COMPLETED |
| season_status_enum | UPCOMING, ACTIVE, CLOSED |
| xp_source_type_enum | VERIFIED_MISSION, LEGACY_ACHIEVEMENT |
| hasil_kompetisi_enum | PARTICIPANT, FINALIST, JUARA_3, JUARA_2, JUARA_1 |
| badge_type_enum | RANK_UP, LEADERBOARD_POSITION |
| reward_context_enum | CAREER, SEASONAL, LEADERBOARD |
| scope_type_enum | PROGRAM_STUDI, FAKULTAS, UNIVERSITAS |
| mode_lomba_enum | ONLINE, OFFLINE |
| biaya_pendaftaran_enum | GRATIS, BERBAYAR |
| cakupan_peserta_enum | INTERNASIONAL, NASIONAL, REGIONAL, INTERNAL |
| kategori_lomba_enum | BUSINESS_MANAGEMENT, RESEARCH_SCIENTIFIC, TECHNOLOGY, CREATIVE_MEDIA, COMMUNICATION |
| kategori_penyelenggara_enum | PEMERINTAH_KEMENTERIAN, BUMN, SWASTA_BESAR, UNIVERSITAS_NASIONAL, UNIVERSITAS_LOKAL_INTERNAL, HIMPUNAN_UKM_KOMUNITAS |

### DATA-30 Relasi dan consistency contract

Semua FK user pada tabel domain mengarah ke profiles.user_id; profiles.user_id sendiri ke auth.users.id. FK season ke seasons.season_id; tier ke mission_tiers.tier_id; badge ke badge_definitions.badge_id. Membership/application menggunakan FK gabungan (squad_id, mission_id), bukan dua relasi bebas yang dapat mismatch. Field *_by menunjukkan aktor tindakan, bukan otomatis hak untuk mengubah row tersebut.

| Relasi | Kardinalitas |
|---|---|
| auth.users → profiles | 1:1 |
| fakultas → program_studi → profiles | 1:N pada setiap hubungan |
| primary_classes → profiles / skills | 1:N pada masing-masing hubungan |
| profiles ↔ skills | N:M melalui user_skills |
| mission_submissions → missions | 1:0..1 untuk jalur approval; source_submission_id opsional untuk data Mission administratif |
| missions → squads | 1:N |
| squads → members / requirements / applications / messages | 1:N pada masing-masing hubungan |
| squads → mission_result_submissions | 1:0..1 |
| mission_result_submissions → xp_transactions | 1:N, satu per penerima ACTIVE dan result |
| achievement_claims → xp_transactions | Maksimal satu transaksi normal per pemilik/claim |
| profiles → user_badges / notifications / histories | 1:N |
| seasons → xp_transactions / histories | 1:N, season_id transaksi boleh NULL |

Jangan menambahkan cascade delete berdasarkan tabel relasi ini. Periksa FK aktual dan dampaknya terhadap ledger/riwayat sebelum mengubah kebijakan deletion.

## 12. Snapshot progres dan bukti

**Pembaruan 13 Oktober 2026:** tabel September di bawah adalah sejarah, bukan status terkini. Lihat [rencana rilis dan status verifikasi 13 Oktober](../RELEASE_PLAN_2026-10-18.md) untuk integrasi frontend/badge, dependency, remediasi akses, hasil QA Storage yang dilaporkan owner, scheduler dan batas pengujian. Target terbaru 18 Oktober adalah backend siap integrasi; tanggal rilis lengkap masih bersyarat pada kesiapan frontend dan gate rilis.

Tanggal bukti 6–7 September 2026; bukan audit live saat PRD disusun. A1: 28 tabel dengan RLS enabled, 20 enum, 39 function, 23 trigger, 156 constraint, 98 index, 99 policy. Jumlah constraint/index bisa mencakup pasangan unique constraint dan backing index, bukan 254 business rule berbeda. ZIP hanya M1/M2, bukan migration foundation lengkap.

| Area | Bukti struktural / laporan | Status runtime |
|---|---|---|
| Foundation 28 tabel | A1 sesuai nama entitas D0 | Tidak semua rule diuji |
| Auth/onboarding/Home/Discovery | H1/D1 implementation reported | Tidak diaudit ulang dari repository |
| Mission Detail | Route server, tier, RPC nama Ketua, list/filter | PASS dilaporkan: nama Ketua, empty, hide completed; Locked/expired/nonaktif pending |
| Create Squad database | A1, M2, trigger/index | PASS dilaporkan: create, Ketua, requirements, rollback transaksi tes, direct INSERT denial |
| Create Squad action/UI | H1/D1: actions.ts, CreateSquadForm.tsx, inline page; static checks dilaporkan PASS | Validasi 12 total → 11 slots; sukses persistent browser belum tercatat PASS |
| Batas min/max Mission | D1/H1 target | PLANNED — NOT YET DEPLOYED |
| Apply/leave/kick/finalize | Function dan guards ada di A1 | End-to-end/Frontend NOT VERIFIED, bukan seluruh backend belum dibuat |
| Validation/XP/Badge/Season | Tabel dan function ada di A1 | End-to-end, concurrency, seed, live views/scheduler NOT VERIFIED |
| Endorsement/Intervention | Tabel/guard/policy ada | Frontend dan semua tindakan admin NOT VERIFIED |
| Chat | squad_messages dan policy, delete setelah approval | Realtime/Storage UI flow NOT VERIFIED |
| Cleanup | last_activity_at dan index | Implementasi cleanup tidak ditemukan di snapshot public/dua migration; scheduler di luar export belum diketahui |

Rollback transaksi tes bukan bukti lengkap bahwa error pada setiap tahap berhasil diuji. Acceptance kegagalan tengah transaksi harus direkam tersendiri. PRD tidak menyebut seluruh keamanan PASS hanya karena RLS aktif.

Object penting untuk inspeksi berikutnya:

- profiles_email_role_check; guard_profile_insert/update; handle_new_nexus_user; check_user_skill_limit.
- get_mission_squad_leaders; profiles_select_self_or_admin; missions_read; squads_read.
- create_squad; guard_squad_insert; squads_add_leader_after_insert (trigger) → after_squad_insert_add_leader (function).
- squad_members_one_active_squad_per_mission_uq; squad_members_one_active_leader_per_squad_uq; squad_requirements_squad_class_uq; squads_capacity_positive.
- squad_members_squad_mission_fk; squad_applications_squad_mission_fk; guard_squad_application_insert; decide_squad_application; cancel_squad_application; leave_squad; kick_squad_member; finalize_squad.
- guard_mission_submission_insert/update; after_mission_submission_review; missions_dedup_uq; mission_submissions_dedup_uq.
- guard_mission_result_insert/update; after_mission_result_review; guard_achievement_claim_insert/update; after_achievement_claim_review; guard_xp_transaction_source; xp_transactions_verified_once_uq; xp_transactions_legacy_once_uq.
- after_xp_transaction_award_badges; award_rank_milestones; user_badges_one_equipped_uq; equip_badge; refresh_leaderboard_badges; close_active_season.
- squad_messages_read_active_member; squad_messages_insert_active_member; guard_endorsement_insert; guard_admin_report_insert/update; guard_notification_update.

Enam object turunan terinventaris kolomnya: public_profiles, career_xp_totals, current_seasonal_xp_totals, leaderboard_program_studi, leaderboard_fakultas, leaderboard_universitas. Definisi SELECT/view, owner/security_invoker tidak dicakup A1; jangan menyatakan formula/keamanannya terverifikasi hanya dari nama kolom.

## 13. Register konflik, keputusan, dan larangan asumsi

### 13.1 Konflik yang diselesaikan dari sumber

| ID | Resolusi tunggal | Dasar |
|---|---|---|
| D01 | Domain mahasiswa mhs.unesa.ac.id; admin berbeda sesuai snapshot; bukan global search/replace domain admin | H1/D1, A1 |
| D02 | NULL Class sebelum onboarding; tepat satu setelah onboarding | A1, H1 |
| D03 | FINALIZED status resmi; Locked label FULL/FINALIZED | D0/D1, H0/H1 |
| D04 | C termasuk Ketua; recruitment C-1; Class Ketua tidak mengurangi requirement | M2, H1/D1 |
| D05 | Min/max Mission target baru, bukan deployed | H1/D1 |
| D06 | Backend lanjutan STRUCTURE PRESENT, aplikasi di luar slice completed bukan OUTSIDE MVP | A1 vs wording H1/D1 |
| D07 | Admin Intervention semula target MVP, tetapi laporan masalah Squad ditunda oleh ketua tim 8 Oktober 2026; keputusan penundaan tidak berarti menghapus desain/history | Keputusan ketua tim 8 Oktober 2026 |
| D08 | Achievement Title dan Partner Mission OUTSIDE MVP | D0/D1 |
| D09 | Resubmit achievement pakai ID sama; achievement_date menggantikan tahun saja | D0/D1 |
| D10 | Tie-break final XP → reached_at → user_id; snapshot bukan reset fisik XP | D0/D1 |
| D11 | Rank-Up event kredit XP; badge posisi weekly; bukan semua badge weekly | H0 §§8.5,9.4 |
| D12 | Guard status, service role administratif dan privileges biasa dibedakan | A1, M1/M2 |

### 13.2 Gap terbuka dan keputusan terkait

| ID | Masalah / status | Aksi sebelum implementasi terkait |
|---|---|---|
| G01 | RESOLVED 8 Oktober 2026: NEXUS Mission hanya lomba tim | Max=1 tidak valid untuk Mission/Squad baru; lomba individu di luar NEXUS melalui Klaim Achievement; data lama mengikuti audit G02 |
| G02 | Audit 12 Oktober: 2 Mission, tidak ada batas NULL atau max<2. Kebijakan perubahan batas Mission dengan Squad masih NEEDS DECISION | Tidak perlu backfill saat ini; tetap jangan hapus Squad atau menebak batas ketika ada data baru |
| G03 | RESOLVED 30 September 2026: kapasitas target vs jumlah ACTIVE ketika Finalize | Jumlah ACTIVE minimal `missions.min_anggota_tim`; FULL tidak wajib; PENDING tidak menghalangi; minimum NULL menahan Finalize. Validasi ulang dalam RPC. |
| G04 | RESOLVED 8 Oktober 2026: kebutuhan diisi, keputusan accept/reject di tangan Ketua | Tampilkan Class/Skill pelamar; jangan auto-reject mismatch. Skill tambahan pada Create masih UI-G02 |
| G05 | Create ketika ada PENDING application lain | RESOLVED 12 Oktober: auto-cancel hanya PENDING pembuat pada Mission sama dalam transaksi Create. Migration dan RPC runtime Supabase PASS; browser QA belum |
| G06 | RESOLVED 13 Oktober: transfer dan pembubaran solo sebelum Finalized | Transfer ke anggota ACTIVE; solo disband menyimpan DISBANDED/history, mengakhiri membership dan membatalkan PENDING dengan notifikasi secara atomic. Runtime rollback PASS; browser dan concurrency COMMIT belum terverifikasi penuh |
| G07 | Cleanup chat-only idle >30 hari, skip PENDING. Dua urutan concurrency chat/cleanup COMMIT PASS 11 Oktober; job harian 12 Oktober 02.00 WIB succeeded | Cleanup vs submit hasil dan refresh browser belum diuji. Pembubaran/reopen tetap belum diputuskan; H-3 proposal |
| G08 | Skills lintas-Class dan perubahan Class setelah join; UI disepakati 14 Oktober: pilihan tambah Skill mengikuti Primary Class | Pertahankan bebas ubah dan Skill existing; filter dropdown bukan constraint database atau izin menghapus Skills/membership |
| G09 | Populasi STUDENT ACTIVE termasuk 0 XP, tanpa ADMIN/SUSPENDED. Job mingguan Senin 12 Oktober 00.00 WIB succeeded dan mencatat 9 badge baru; coverage saat audit lengkap | Kebijakan historical/current serta exact 3% belum berubah. Browser badge masih perlu diuji setelah perbaikan pembacaan relasi profil |
| G10 | WIB tanpa masa tenggang; late approval Career-only, snapshot CLOSED tetap. Cutoff/rollover sequential rollback PASS; closure vs Legacy approval benar-benar menunggu lock pada 11 Oktober, keduanya rollback | Season worker terjadwal nyata succeeded 12 Oktober; bukan rollover Juli nyata. Reverse order dan rollover/Verified concurrency COMMIT masih belum diuji |
| G11 | Mission expired RLS berbeda target; NOT VERIFIED | Inspect current policy dan implementasi; fix hanya dalam task berizin |
| G12 | Skill ke-5/ke-6 concurrency dua sesi PASS 11 Oktober, termasuk observer lock; bukti di PR #30 | Bukti itu tidak menutup seluruh write path PENDING/requirements atau acceptance lain |
| G13 | View definitions, function owner/ACL, Storage, Realtime, scheduler, seeds tidak lengkap di A1 | Minta metadata minimum saat scope membutuhkan; jangan menyatakan absent global |
| G14 | Hak maintenance user_skills/endorsements dicabut 11 Oktober; assertion ulang ACL/RLS PASS 12 Oktober. Audit keamanan global tetap belum selesai | Sisa view/function/Storage/Auth dan dependency tercatat di rencana rilis; jangan menganggap semua definer adalah celah atau mencabut grant massal |

G14 penting: A1 memuat grants luas selain INSERT; RLS tidak boleh dipakai sebagai bukti bahwa setiap jenis privilege aman. Tidak ada exploit runtime yang dijalankan. Jangan menghapus grants secara massal tanpa mapping dampak dan task eksplisit.

## 14. Acceptance criteria dan verification matrix

Semua hasil berikut adalah target test kecuali status PASS dilaporkan secara spesifik pada bagian 12. Gunakan akun/fixture berizin; jangan merusak data asli. Catat scope, environment, commit/migration, waktu, expected/actual dan cleanup.

| Test ID | Skenario | Hasil wajib |
|---|---|---|
| T01 | Register STUDENT valid, invalid domain, duplicate NIM/email | Valid tersimpan auth+profile; invalid gagal; tidak orphan profile/auth yang tak tertangani |
| T02 | Login belum onboarding, suspended, session expired | Guard tepat; request palsu tidak melewati server/DB |
| T03 | Tambah Skill ke-6 termasuk request bersamaan | Maksimal lima; gagal tanpa data liar |
| T04 | Add Mission expired, dedup exact, reject/resubmit, approve | Tidak tayang pending; ID resubmit sama; approved Mission tunggal; tanpa XP |
| T05 | Discovery before/equal/after deadline | Hanya sebelum deadline tampil; detail lama target tetap bisa dibaca eligible |
| T06 | Kartu empat status | Open; Locked FULL; Locked FINALIZED; completed absen dari recruitment |
| T07 | Create C=2, satu slot, nama/deskripsi whitespace | Valid satu Ketua+requirement; whitespace ditolak |
| T08 | Requirements kosong, duplicate, invalid Class, string/fraction/negative slots | Ditolak di server/RPC, bukan client saja |
| T09 | Total slot C-2/C/C-1 | Hanya C-1 valid |
| T10 | Fail saat insert requirements setelah Squad/leader dibuat | Seluruh perubahan rollback; test tidak sekadar rollback manual transaksi sukses |
| T11 | anon RPC, authenticated direct INSERT, forged user/role/status | Ditolak/diabaikan sesuai kontrak; identitas dari auth.uid |
| T12 | Dua Create bersamaan pada user/Mission sama | Maksimal satu membership ACTIVE; error loser aman |
| T13 | Mission min3/max5: C2/3/5/6; exact4 | Setelah capacity deployment hanya C3/5 dan exact C4 diterima |
| T14 | Browser sukses Create | Satu Squad persistent, Ketua tunggal, requirement benar, refresh/card, pending/reset benar |
| T15 | Apply keempat PENDING, duplikasi, accept bersamaan | Max tiga pending; max satu active per Mission; cancellation atomic |
| T16 | FULL leave/kick; FINALIZED leave/kick; actor bukan Ketua | Open kembali sebelum finalized; setelah finalized ditolak untuk ordinary user |
| T17 | Result oleh anggota/belum Finalized, repeat approve, injected XP | Ditolak; reward benar sekali per ACTIVE; no ADMIN_REMOVED XP; chat dihapus |
| T18 | Legacy lama vs season aktif, resubmit, retry | Career benar; seasonal assignment benar; tidak double credit |
| T19 | Threshold 299/300/600/999/1000/2500/6000 dan multi-threshold | Rank/reward sesuai, tanpa duplicate |
| T20 | XP tie, populasi nol/kecil, scope, search | Deterministic rank dan no division by zero; test keputusan G09 |
| T21 | Equip dua badge concurrent, badge lama, badge milik orang lain | Maksimal satu equipped; owner-only; old season tetap eligible |
| T22 | Chat nonmember/LEFT/removed/admin/completed | Read/send ditolak sesuai policy; Realtime tidak membocorkan pesan |
| T23 | Endorse self/non-rekan/belum completed/rating invalid/duplicate | Ditolak; empat rating benar; tidak memberi XP |
| T24 | Intervention bukan ACTIVE FINALIZED, ubah request, illegal status jump | Ditolak; admin tanpa chat; tindakan terlacak |
| T25 | Storage unauthorized upload/download/delete | Ditolak; file authorized bisa dibuka reviewer/pemilik yang berhak |
| T26 | Close season retry/concurrent approve, historical badge | Snapshot konsisten, Career tetap, tidak duplicate atau hilang history |

Static verification: TypeScript/lint/build sesuai scripts repository; audit direct writes, field ownership/status, secret exposure dan diff file. Static PASS tidak menggantikan T01–T26. Belum diuji = NOT VERIFIED, bukan PASS. Bila test gagal, laporkan dengan bukti dan jangan menyelesaikan milestone semu.

## 15. Urutan kerja dan definition of done

### Tahap berikutnya, bukan izin eksekusi otomatis

Urutan berikut adalah slice pengembangan terdekat, bukan pembatas scope produk. Kontrak UI bagian 17 mencakup seluruh desain Canva, termasuk profil, history, Endorsement, notifikasi, dan form pendukung. Setiap halaman tetap memiliki acceptance sendiri walaupun belum masuk slice implementasi sekarang.

1. Inspect repository, AGENTS.md, current migrations dan schema relevan; cocokkan snapshot.
2. Selesaikan keputusan blocking kapasitas (G01/G02/G03 sesuai scope) dan rencana migration/backfill.
3. Satu slice database batas Mission: field, validasi, copy approval, compatibility, test.
4. Setelah DB terverifikasi, satu slice action/UI: baca batas, validasi, pending/error/sukses, test browser.
5. Uji sisa Mission Detail dan security yang bersinggungan; catat gap terpisah.
6. Baru lanjut Apply/Join bila slice sebelumnya stabil. Fitur Chat/Finalize/Validation dst tetap target MVP tetapi tidak dikerjakan sekaligus.

Definition of done per slice: tujuan terpenuhi; perubahan hanya file berizin; rules server+DB relevan terjaga; migration deployment terbukti bila diperlukan; static dan runtime acceptance terkait lulus; tidak menyisakan data test; tidak ada secret; status/dokumen diperbarui dengan provenance. Deploy production memerlukan otorisasi tersendiri sesuai task.

### Format handoff untuk AI coding agent

Untuk setiap task, tulis: Objective tunggal; requirement ID PRD; konteks dan status aktual; file yang diperiksa; file yang boleh diubah; tabel/function terkait; behavior; constraints; forbidden changes; test IDs; verifikasi; blocker. Jika path belum diketahui, cari dulu, jangan klaim file dibuat atau tidak ada.

Output akhir agent: ringkasan hasil → file diubah → perubahan schema/deployment jika ada → test PASS/FAIL/NOT RUN → gap/risiko → next smallest safe step. Jangan memberikan persentase progres tanpa baseline dan bukti.

## 16. Traceability dan pemeliharaan PRD

| Bagian PRD | Sumber utama |
|---|---|
| 0–1,4,14–15 | Instruksi proyek pengguna dan aturan handoff konsolidasi; test turunan requirement, bukan hasil tes baru |
| 2–3,5 | H0/H1 §§1–3,12–14; D0/D1 akun; A1 profile |
| 6 | H0/H1 §4 dan §16; D0/D1 Mission; A1 missions_read |
| 7 | H0/H1 §5,16; D0/D1 Squad; A1; M1/M2 |
| 8–9 | H0/H1 §§8–11; D0/D1 XP/Season/Badge/Endorsement; A1 function |
| 10 | H0/H1 §§5.8,6,7; D0/D1 chat/admin/storage; A1 policy |
| 11 | D0/D1 entitas 1–28, dengan klarifikasi akun dan provenance dari A1 |
| 12 | A1/M1/M2 dan laporan H1/D1; bukan inspeksi repository terkini |
| 13 | Rekonsiliasi bukti sumber dan gap yang belum boleh ditebak |
| 17–19 | C1 dan arahan pengguna tentang seluruh isi UI; aturan kanonik bagian 5–10; gap dan acceptance turunan, bukan hasil tes baru |

Saat keputusan berubah: update satu aturan kanonik, daftar keputusan, acceptance test dan status deployment bersama. Jangan membiarkan target baru muncul sebagai “deployed” hanya karena field ditambahkan ke tabel PRD. File lama tetap arsip; agent mengacu pada PRD ini untuk target dan actual code/schema untuk fakta implementasi.

Changelog v1.0: konsolidasi H0/D0/H1/D1; pisahkan target/aktual/test; tegaskan domain per role dan onboarding nullable; batas Mission tetap planned; perjelas Locked/Finalized dan backend-vs-frontend; catat gap keputusan; tambahkan traceability serta acceptance test. Tidak ada fitur OUTSIDE MVP yang dimasukkan ke implementasi wajib.

## 17. Kontrak isi UI seluruh halaman

### 17.1 Tujuan dan batas bukti

Referensi C1: [Desain Canva NEXUS](https://www.canva.com/design/DAHNXwyayR0/YuKGoezvq2akugHUaqfGlg/edit).

Pengguna meminta kesesuaian **apa yang ditampilkan dan pilihan yang tersedia**, tanpa meniru desain visual. Bagian ini adalah TARGET UI seluruh produk, bukan hanya Mission. Gunakan komponen dan route existing jika ada; modal, panel inline, atau halaman terpisah boleh mengikuti pola aplikasi sepanjang informasi, aksi, dan hak akses sama. Jangan mengonversi tautan internal Canva seperti #page-a menjadi route aplikasi.

Bukti C1 yang tersedia adalah hasil ekstraksi rich text seluruh desain pada percakapan ini. Ekstraksi memuat pengulangan, contoh data, typo, dan teks template. Gambar tanpa teks, ikon tanpa label, isi dropdown yang belum terlihat, dan perilaku klik tidak otomatis terbukti. Nomor halaman tidak dipastikan dari urutan ekstraksi; lokasi di bawah disebut berdasarkan judul/teks layar. Tidak ada audit visual penuh atau pengujian prototype yang diklaim.

Label provenance:
- **C1:** teks/kontrol ditemukan dalam Canva.
- **PRD:** requirement sumber kanonik yang melengkapi layar, walaupun tidak tampak lengkap di Canva.
- **NEEDS DECISION UI-Gxx:** detail belum ditetapkan; hanya bagian terkait yang diblokir.

Semua data contoh, nama pengguna, XP, tahun, hitungan, tanggal, dan isi chat C1 tidak boleh menjadi data produksi atau seed otomatis. Opsi Class/Skill/Tier menggunakan master data yang valid. Label ramah pengguna dipetakan ke enum DATA-29, bukan menjadi enum baru.

### 17.2 Perilaku bersama seluruh layar

1. **Loading:** tampilkan status pemuatan sesuai pola aplikasi; jangan menampilkan data contoh sebagai hasil query.
2. **Kosong:** bedakan belum ada data, pencarian tidak menemukan hasil, dan tidak berhak mengakses. Query gagal bukan keadaan kosong.
3. **Error:** pesan dapat dipahami, tidak memuat stack/secret; sediakan cara mencoba lagi yang tidak menggandakan mutasi.
4. **Form:** label jelas, error dekat input, nilai input dipertahankan saat validasi gagal, indikator pending dan pencegah submit berulang. Validasi server tetap berlaku.
5. **Sukses:** hanya setelah respons server berhasil; tampilkan hasil dan perbarui data terkait. Reset/tutup mengikuti flow halaman, bukan sebelum operasi selesai.
6. **Hak akses:** bedakan pemilik/pengunjung profil, Ketua/anggota, dan admin. Menyembunyikan tombol tidak menggantikan authorization server/RLS.
7. **Navigasi:** kembali/batal tanpa mengirim form. Gunakan link untuk perpindahan dan button untuk aksi; kontrol dapat dipakai dengan keyboard dan label terbaca.
8. **Angka:** Career XP, Seasonal XP, progression Rank, posisi Leaderboard, Tier Mission, kapasitas, dan anggota ACTIVE adalah data berbeda; jangan saling dipertukarkan.
9. **Waktu:** tanggal memakai data sebenarnya dan timezone konsisten; batas deadline mengikuti server. Countdown yang definisinya belum ada mengikuti UI-G05, bukan angka contoh.
10. **Status belum dibuat:** dokumentasi kontrol bukan izin memasang tombol sukses palsu. Implementasikan dalam slice terkait dan laporkan statusnya secara jujur.

### UI-01 Navigasi global

**Dasar:** C1 navbar berulang; bagian 3 dan AUTH-01.

- Menu Home, Missions, My Squad, Leaderboard; avatar/identitas ringkas menuju profil sendiri; akses Notifikasi.
- Tunjukkan lokasi aktif secara konsisten; menu tetap tersedia lintas halaman utama.
- Pengunjung tanpa sesi diarahkan melalui flow Auth; onboarding belum selesai mengikuti guard. Login/registrasi tidak menggunakan navbar yang memberi akses privat.
- Logout dan perilaku sesi mengikuti implementasi Auth existing. Tidak menambah menu My Finance karena teks tersebut merupakan kandidat residu template C1 (UI-G11).
- **Data/tes:** sesi dan profile; uji navigasi serta session expired, T02 dan U01.

### UI-02 Login dan registrasi

**Dasar:** C1 “Masuk”, “username”, “password”, tautan Registrasi; field registrasi lengkap dari AUTH-01.

- Login: Email Mahasiswa UNESA dan password, tombol Masuk, tautan Registrasi. Label username C1 diganti email sesuai sistem Auth; tidak menambah username database.
- Registrasi: nama lengkap, NIM, email mahasiswa, password/konfirmasi, Fakultas, Program Studi, tahun masuk, persetujuan syarat. Opsi Program Studi mengikuti Fakultas.
- Password tidak ditampilkan ulang sebagai teks biasa atau disimpan di profile; role ADMIN/status akun tidak menjadi pilihan registrasi.
- Berhasil login: guard menentukan onboarding atau halaman utama. Berhasil registrasi mengikuti konfigurasi email confirmation existing; jangan menjanjikan langsung login jika belum diverifikasi.
- Error domain, password tidak cocok, akun sudah ada, kredensial salah, akun suspended, dan gangguan layanan ditangani tanpa membocorkan data akun lain. Akun admin mengikuti domain/role kanonik, bukan form pemilihan role bebas.
- **Data/tes:** Supabase Auth, profiles, fakultas, program_studi; T01–T02, U01.

### UI-03 Onboarding

**Dasar:** PRD CLASS-01; tidak ada layar onboarding lengkap yang terbukti dalam ekstraksi C1.

- Pemilihan tepat satu Primary Class: Strategist, Researcher, Technical, Creative, Communicator; pilihan valid dari master data.
- Pemilihan Skills dengan indikator jumlah maksimal lima; minimum Skill tidak ditambahkan. Aturan lintas-Class mengikuti G08.
- Aksi simpan/lanjut melengkapi profile lalu membuka flow utama. Primary Class kosong tidak boleh melewati guard.
- Jika master data gagal dimuat, tampilkan error; jangan mengganti dengan ID Class/Skill hardcode.
- **Data/tes:** primary_classes, skills, profiles, user_skills; T02–T03, U02.

### UI-04 Home

**Dasar:** C1 “Selamat Datang”, Career XP, Season XP, Leaderboard Program Studi, Mission Aktif.

- Sapaan nama pengguna; kartu Career XP beserta Career Rank dan progres menuju threshold berikutnya; kartu Seasonal XP beserta Season Rank dan progresnya.
- Ringkasan Leaderboard Program Studi: posisi, nama/avatar, Primary Class, Seasonal XP, dan Lihat Selengkapnya menuju Leaderboard.
- Mission aktif pengguna: nama kompetisi, nama Squad, Tier Mission, cakupan, biaya; Lihat Selengkapnya menuju My Squad sebagaimana konteks C1.
- Jumlah item ringkasan mengikuti keputusan/pola existing; lima contoh peringkat di C1 tidak menjadi limit database. Tidak mengubah ranking untuk memaksa user selalu masuk ringkasan.
- Tanpa Squad aktif tampilkan empty state dengan akses Missions. Tanpa season ACTIVE jangan menampilkan season palsu; Career tetap dapat ditampilkan.
- Diamond tidak diberi target rank baru buatan. Nilai progres memakai RANK-01, bukan pasangan 500/Gold atau 2450/Platinum C1 yang tidak konsisten.
- **Data/tes:** profile, total XP, active season, leaderboard, membership/Mission; U03.

### UI-05 Mission Discovery

**Dasar:** C1 Search, Filter, kartu Lihat Detail; MIS-02.

- Pencarian Mission dan filter normatif: kategori, Tier S/A/B/C, Online/Offline, Gratis/Berbayar. Opsi kategori mengikuti MIS-02 dan DATA-29.
- Kartu: nama Mission, Tier, cakupan, biaya, mode, XP dasar Participant sesuai Tier, jumlah Squad Open Recruitment, tombol Lihat Detail.
- Scope hitungan recruitment hanya Squad OPEN_RECRUITMENT pada Mission terkait; jangan menghitung FINALIZED/completed sebagai sedang recruitment.
- Label “Provinsi” pada contoh tidak membentuk enum baru; gunakan cakupan REGIONAL sesuai data. Filter cakupan tambahan tidak dianggap disepakati hanya karena cakupan tampil di kartu (UI-G01).
- Entry Add Mission tetap tersedia sesuai MIS-01 walaupun form tidak lengkap di C1.
- Bedakan daftar kosong, tidak ada hasil filter, query gagal. Mission expired tidak berada di Discovery; akses detail mengikuti MIS-02.
- **Data/tes:** missions, mission_tiers, xp_rules, squads; T05, U04.

### UI-06 Add Mission dan status pengajuan

**Dasar:** PRD MIS-01/DATA-8; layar lengkap tidak terbukti pada C1.

- Field mengikuti MIS-01 dan kamus data mission_submissions: nama, penyelenggara, kategori penyelenggara, link resmi, deadline pendaftaran/lomba, tahun, kategori lomba, cakupan, mode, biaya, deskripsi, poster/dokumen.
- Batas minimum/maksimum anggota termasuk Ketua wajib diisi pada pengajuan baru sesuai schema dan trigger aktif; bukan pilihan kapasitas Squad bebas. Data lama yang nullable tetap mengikuti G02.
- Aksi ajukan dan batal; saran duplikasi dengan penolakan exact duplicate; tidak ada preview pemberian XP karena Add Mission tidak memberi XP.
- Setelah kirim tampilkan PENDING; APPROVED terhubung ke Mission resmi; REJECTED menampilkan alasan dan aksi perbaiki/ajukan ulang dengan ID sama. Lokasi daftar pengajuan mengikuti pola repository dan perlu ditetapkan jika belum ada, bukan mengarang route dari Canva.
- Tier final ditetapkan admin, bukan nilai final pilihan pengaju. Deadline tidak valid/expired, upload gagal, dan duplikat ditangani sebagai error spesifik.
- **Data/tes:** mission_submissions, missions, Storage; T04, T13, T25, U04.

### UI-07 Mission Detail dan recruitment

**Dasar:** C1 “Deadline Pendaftaran”, “Squad Tersedia”, “Ukuran Squad”, “Tier XP”, “Semua/Open Recruitment/Locked”, “Add Squad”.

- Informasi: nama, kategori, penyelenggara, cakupan, deadline pendaftaran, jumlah Squad dalam daftar recruitment, rentang peserta resmi Mission bila tersedia, Tier dan XP; detail lain mengikuti data Mission/PRD.
- Bedakan jumlah seluruh Squad recruitment (OPEN/FULL/FINALIZED) dari jumlah yang masih Open di UI-05. Filter Semua tetap mengecualikan MISSION_COMPLETED.
- Pilihan Semua, Open Recruitment, Locked; Locked mencakup FULL dan FINALIZED tanpa mengganti enum.
- Kartu Squad: nama, deskripsi ringkas, identitas anggota yang boleh terlihat, jumlah ACTIVE/kapasitas total, status; nama Ketua sesuai implementasi dan akses RPC existing.
- Add Squad/Buat Squad membuka UI-09. Klik kartu/detail membuka UI-08 sesuai pola aplikasi.
- Deadline lewat: informasi detail tetap target terbaca sesuai guard, Create/Apply dibatasi aturan server; gap RLS G11 tetap dicatat. Squad completed masuk history, tidak menghilangkan Mission.
- “Verified · Gold” tidak dipakai untuk menyamakan Tier Mission dengan Career/Season Rank; gunakan Tier S/A/B/C dan XP sesuai sumber.
- **Data/tes:** missions, mission_tiers, squads, memberships, get_mission_squad_leaders; T05–T06, U05.

### UI-08 Detail Squad dan Minta Gabung

**Dasar:** C1 Thunder Squad, deskripsi, nama/Class/Skill anggota, “Minta Gabung”, “Tutup”; SQ-03.

- Nama Squad, Mission terkait, status, jumlah ACTIVE/kapasitas, deskripsi penuh, anggota dan peran Ketua/anggota. Tampilkan Primary Class/Skills melalui data yang boleh diakses.
- Kebutuhan recruitment dari squad_requirements ditampilkan sebagai informasi bagi Ketua; mismatch Class/Skill tidak menyebabkan penolakan otomatis sesuai keputusan G04.
- Minta Gabung membuat application PENDING; keberhasilan bukan berarti sudah menjadi anggota. Jika PENDING tampilkan status serta pembatalan milik sendiri sesuai SQ-03.
- Jika sudah anggota Mission sama, kuota PENDING habis, deadline lewat, atau Squad Locked, tampilkan alasan aksi tidak tersedia. Validasi ulang di server untuk perubahan status bersamaan.
- Tutup kembali ke daftar tanpa mutasi. Detail anggota tidak boleh membuka email/NIM karena kartu Canva memuat identitas publik saja.
- **Data/tes:** squads, squad_members, squad_requirements, squad_applications, public profile projection; T15, U05–U06.

### UI-09 Create Squad

**Dasar:** C1 Nama Squad, Deskripsi, “Skill yang dibutuhkan”, “Pilih skill”, “max 5”, “Buat”; kontrak kanonik SQ-02.

- Field final: nama, deskripsi, kapasitas total termasuk Ketua, baris requirement berisi Primary Class dan slot positif; tambah/hapus baris; indikator slot teralokasi dan tersisa.
- Tampilkan Mission yang dipilih dan batas resmi saat MIS-03 siap. Pilihan kapasitas wajib berada dalam rentang valid; max=1 mengikuti G01.
- “Skill yang dibutuhkan max 5” C1 tidak menggantikan array Primary Class/slot RPC. Pemilihan Skill recruitment tambahan belum memiliki kontrak di create_squad; UI-G02.
- Tombol Buat, pending, error field/server, lalu reset/tutup dan refresh daftar setelah RPC sukses. Data Ketua, role, status tidak menjadi input.
- Tidak mengurangi kebutuhan berdasarkan Class Ketua. Ringkasan menjelaskan total kapasitas C dan recruitment C-1.
- **Data/tes:** SQ-02, M2, squads, squad_requirements, leader trigger; T07–T14, U06.

### UI-10 My Squad dan riwayat Squad

**Dasar:** C1 “Squad Aktif dan Riwayat Tim Kamu”, “Squad Room”, peran, hasil/XP/bulan history.

- Dua kelompok: Squad aktif dan riwayat, beserta jumlah berdasarkan data user lintas-Mission.
- Kartu aktif: nama Squad/Mission, Tier, cakupan/biaya/mode, anggota ACTIVE/kapasitas, status, peran user, avatar yang berhak ditampilkan, akses Squad Room.
- History: nama Squad/Mission, Tier, cakupan, peran historis user; hasil tervalidasi, XP yang benar-benar diterima user, dan tanggal jika tersedia. LEFT/KICKED tidak otomatis dianggap meraih hasil/XP tim.
- Tombol Squad Room membuka Squad terkait; history tidak menghidupkan kembali chat yang sudah dihapus.
- Pada history MISSION_COMPLETED, kartu menampilkan satu tombol utama Detail Squad dan tautan kecil Lihat Mission. Detail Squad memuat ringkasan hasil approved, XP user dari ledger, tautan pengajuan untuk anggota ACTIVE dan daftar anggota saat finalisasi dari `finalized_squad_members`. User sendiri terlihat dengan label (Kamu) tanpa aksi menilai diri; nama rekan diambil dari proyeksi profil publik. Tampilkan status sudah dinilai/ditutup; tautan profil membawa konteks Squad dan akses kembali ke daftar rekan. LEFT/KICKED tetap mengikuti eligibility END-01. Jalur ini tidak memerlukan pencarian di Leaderboard.
- “Waktu Tersisa 30/60 Hari”, “11/50 Hari” tidak disalin tanpa definisi awal/akhir; UI-G05. Simbol tambah tanpa fungsi yang terbukti mengikuti UI-G11.
- Empty active/history masing-masing jelas. Jangan menampilkan “5/5 Open” hanya karena contoh Canva; status mengikuti SQ-01 dan actual data.
- **Data/tes:** memberships termasuk riwayat, squads, missions, hasil, xp_transactions; T16–T18, U07.

### UI-11 Permintaan Gabung dan pengelolaan anggota

**Dasar:** C1 “Permintaan Gabung Squad”, jumlah menunggu, nama/Class/Skill pelamar; aksi dari SQ-03/SQ-04.

- Ketua melihat Squad yang dikelola, jumlah PENDING, pelamar beserta identitas/kemampuan yang boleh dibaca, akses profil, aksi Terima/Tolak.
- Terima mengikuti transaksi acceptance; perbarui anggota, kapasitas, jumlah pelamar dan status setelah sukses. Jika slot diambil request lain, tampilkan error dan refresh data.
- Tolak mengubah application yang tepat; tidak menghapus profil atau membership user di Mission lain. Pelamar hanya membatalkan PENDING miliknya.
- Leave untuk anggota dan kick oleh Ketua berlaku sebelum FINALIZED; Ketua tidak self-leave. Finalize tersedia sesuai SQ-01/G03 dan mengunci recruitment setelah sukses.
- Canva tidak membuktikan seluruh tombol pengelolaan ini; tombol adalah pelengkap requirement PRD, bukan hasil inspeksi code. Tidak menambah transfer Ketua atau Edit Squad tanpa keputusan/task terkait.
- **Data/tes:** decide_squad_application, cancel_squad_application, leave_squad, kick_squad_member, finalize_squad; T15–T16, U06–U08.

### UI-12 Squad Room dan chat

**Dasar:** C1 Squad APEX, panel Mission/anggota, “Aksi Squad”, chat, “Ketik Disini”; CHAT-01.

- Header: nama Squad, Mission, Tier, jumlah anggota, deadline lomba dari field yang benar.
- Panel Mission: nama, penyelenggara, cakupan, biaya, mode, deadline; panel anggota: nama/avatar, Primary Class, peran, penanda diri sendiri.
- Chat: nama pengirim, isi pesan, waktu, input pesan dan aksi kirim. Nama diri sendiri tetap ditampilkan dengan penanda `(Kamu)`; identitas memakai `sender_id` dan data anggota Room yang berhak diakses. Tidak menambah DM, panggilan video, attachment chat, atau read receipt dari asumsi gambar.
- Pesan kosong ditolak; pending/gagal kirim tidak dianggap pesan tersimpan; refresh/reconnect tidak menggandakan pesan yang sudah tersimpan. Transport Realtime mengikuti verifikasi CHAT-01.
- Ketua FINALIZED mendapat Submit Hasil Mission. Laporan Admin Intervention bagi anggota ACTIVE FINALIZED ditunda sesuai keputusan 8 Oktober 2026; jangan tampilkan aksi yang belum diimplementasikan. Aksi anggota/Finalize mengikuti UI-11, bukan label Locked saja.
- Sebelum FINALIZED chat sudah boleh dipakai. Setelah completed, nonmember, removed, atau admin: akses chat mengikuti CHAT-01; jangan sekadar menyembunyikan input sementara pesan tetap dibaca. URL Room completed milik anggota ACTIVE diarahkan ke Detail Squad tanpa membaca chat/RPC anggota Room. Riwayat anggota yang sudah keluar tetap melalui jalur Detail Squad, bukan akses Room aktif.
- Tidak mengartikan “47%” sebagai progress pekerjaan karena tidak ada kontrak progress task; UI-G05.
- **Data/tes:** squad_messages, membership, missions/squads; T16–T17, T22, U08.

### UI-13 Submit Hasil Mission

**Dasar:** C1 “Pencapaian Tim”, “Konfirmasi Tier”, “Upload Sertifikat”, dokumen opsional, preview XP; VAL-01.

- Ringkasan Squad/Mission dan keterangan hanya Ketua dapat mengirim setelah FINALIZED.
- Pilihan pencapaian: Participant, Finalist, Juara 3, Juara 2, Juara 1, dipetakan ke hasil_kompetisi_enum. Tier yang diajukan S/A/B/C mengikuti VAL-01; bukan perubahan Tier resmi Mission.
- Konfirmasi Tier menampilkan/memilih tier pengajuan sesuai kontrak hasil; admin menetapkan tier/hasil approved. Jangan memberi caller kendali approved_tier/approved_xp.
- Sertifikat tim wajib; maksimal satu dokumen pendukung opsional. Keputusan pengguna 30 September 2026 untuk UI-13: PDF/JPG/PNG, 5 MB desimal (5.000.000 byte) per file. DATA-15 menyediakan satu dokumen_pendukung_path opsional.
- Preview: jenis Verified Mission XP, Tier, hasil, nilai penuh 100%, XP per anggota eligible, label menunggu verifikasi. Jangan membagi XP dengan jumlah anggota.
- Aksi kirim hasil dan Kembali; PENDING menampilkan status untuk anggota terkait; REJECTED alasan/perbaikan pada ID sama; APPROVED menunjukkan hasil final dan Mission Completed.
- Batas UI-13 ditegakkan di server, client, dan bucket Storage privat. Record hasil baru serta resubmit diverifikasi terhadap bukti yang sudah diunggah oleh pemilik ke folder Squad.
- **Data/tes:** mission_result_submissions, xp_rules, Storage, ledger; T17, T25, U09.

### UI-14 Admin Intervention mahasiswa — DITUNDA

**Dasar historis:** C1 “Jenis masalah”, “Anggota yang terlibat OPSIONAL”, deskripsi, timeline laporan; ADM-01. Keputusan 8 Oktober 2026 menunda implementasi layar dan alur ini.

- Ringkasan Squad/Mission/status FINALIZED, jenis masalah, anggota terlibat opsional dari Squad terkait, deskripsi masalah.
- Fitur ditunda (UI-G04); jika dilanjutkan, jenis masalah belum diketahui daftar pilihannya dan field issue_type TEXT bukan daftar enum otomatis.
- Submit Laporan dan Kembali; setelah sukses tampilkan RECEIVED/Laporan Diterima, REVIEWING/Sedang Ditinjau, COMPLETED/Selesai, waktu dan keputusan/tindakan yang tersedia.
- Jelaskan admin tidak dapat membaca chat dan anggota yang ADMIN_REMOVED sebelum approval tidak menerima XP.
- Estimasi 3–5 hari kerja adalah target layanan; tanggal perkiraan individual tidak dihitung dari contoh Canva. Jangan mengklaim SLA telah dijalankan otomatis.
- Hanya anggota ACTIVE pada FINALIZED dapat mengajukan; status laporan tidak dipilih mahasiswa. Tindakan pembubaran/reopen tetap G07.
- **Data/tes:** admin_reports, memberships; T24, U10.

### UI-15 Leaderboard

**Dasar:** C1 Universitas/Fakultas/Program Studi, Search, tiga posisi teratas, kolom #/User/XP/Rank, Season aktif/reset.

- Pilihan scope Universitas (seluruh UNESA), Fakultas sendiri, dan Program Studi sendiri; basis Seasonal XP yang telah dikreditkan dan identitas scope yang jelas. Tidak ada dropdown untuk memilih Fakultas/Prodi lain (UI-G06).
- Tampilkan nama season, periode/tanggal berakhir yang benar; jangan menyalin “Season 2025 Aktif” atau tanggal contoh.
- Tiga posisi teratas beserta nama/avatar, Seasonal XP, Fakultas/Program Studi dan Primary Class; daftar selanjutnya memuat posisi, user, XP, Season Rank. Urutan mengikuti LB-01.
- Search nama mempertahankan posisi asli populasi; membuka profil pengguna yang dipilih. Jumlah pengguna kurang dari tiga tidak diisi dummy.
- Scope Fakultas/Prodi mengikuti unit pengguna sendiri sesuai keputusan 8 Oktober 2026 (UI-G06). Tampilan tanpa season/populasi mengikuti keputusan data dan empty state, bukan error aritmetika.
- **Data/tes:** live leaderboard views perlu verifikasi, seasons, public profiles; T20, U11.

### UI-16 Profil sendiri

**Dasar:** C1 identitas, bio, Class, Skills, XP/Rank, Endorsement, Season/Mission History, Edit/Bagikan/Klaim.

- Nama/avatar, bio, Primary Class, Fakultas, Program Studi, tahun masuk; satu badge equipped beserta konteksnya.
- Career XP/Rank/progres, Seasonal XP/Rank/progres dan season; milestone Bronze sampai Diamond mengikuti RANK-01.
- Skills maksimal lima; ringkasan Endorsement untuk Communication, Contribution, Teamwork, Responsibility beserta jumlah penilaian yang dihitung dari data valid.
- Season History: nama season, Seasonal XP, Season Rank dan posisi/populasi sesuai snapshot yang tersedia. Mission History: kompetisi/hasil yang benar; jangan menyamakan achievement luar Squad dengan membership fiktif.
- Aksi Edit Profil, Bagikan Profil, Klaim Achievement; Lihat Selengkapnya membuka detail section terkait sesuai pola repository, bukan route tebakan.
- Tidak ada Endorse diri sendiri. Tanpa riwayat/penilaian tampilkan keadaan kosong; rata-rata belum ada tidak dibuat sebagai rating 0 dari pengguna.
- **Data/tes:** profiles/public projection, user_skills, XP totals, histories, endorsements, user_badges; T19, T21, T23, U12.

### UI-17 Profil pengguna lain dan pemberian Endorsement

**Dasar:** C1 profil Max Mayfield, “Kategori”, “Send”; END-01 dan CLASS-01.

- Bagian reputasi publik sama dengan UI-16 sesuai izin data; tidak menampilkan Edit Profil/Klaim Achievement milik orang lain atau email/NIM.
- Jika eligible, tampilkan pemberian Endorsement dalam konteks Squad completed yang sama, empat rating integer 1–5, tombol Kirim. Tidak menambah ulasan teks bebas.
- “Kategori/Send” C1 diselaraskan menjadi empat dimensi END-01; tidak mengirim rating kategori sembarang.
- Jika lebih dari satu Squad completed bersama, pemilihan konteks mengikuti UI-G07; jangan memilih squad_id pertama diam-diam. Jika sudah memberi penilaian pada Squad tersebut tampilkan status, bukan form duplikat. Pengajuan tersedia sebelum `completed_at + 336 hours`; tampilkan batas WIB atau status penilaian ditutup. Form lama yang melewati batas ditolak server/database lalu diperbarui, tanpa polling.
- Profil tidak ditemukan, tidak boleh diakses, dan gagal memuat dibedakan. Hak anon dari tautan Bagikan Profil belum disepakati (UI-G08).
- **Data/tes:** public profile projection, endorsements, memberships; T23, U12–U13.

### UI-18 Edit Profil

**Dasar:** C1 Ganti foto, Nama Lengkap, Bio, Primary Class, Skills, Simpan Perubahan; CLASS-01.

- Foto, nama lengkap, bio, tepat satu Primary Class, Skills dengan tambah/hapus dan indikator maksimal lima. Tampilkan seluruh lima Class kanonik termasuk Creative yang tidak konsisten terlihat di daftar C1.
- Keputusan UI 14 Oktober: dropdown tambah Skill hanya menampilkan Skill Primary Class yang dipilih dan belum dimiliki. Ganti Class mereset calon Skill; simpan Class sebelum menambah Skill. Skill existing tetap terlihat dan bisa dihapus, termasuk dari Class lama. Ini filter pilihan UI; constraint database lintas-Class belum ditambahkan.
- Badge Chest dapat diakses sebagai section/panel; aturan equip UI-19.
- Identitas akademik, email, NIM, role, status, XP dan Rank tidak menjadi input edit biasa.
- Simpan Perubahan memperbarui profil setelah validasi; error mempertahankan input. Upload foto gagal tidak boleh dilaporkan berhasil mengganti foto.
- Ukuran/jenis avatar bukan otomatis batas sertifikat; ikuti FILE-01/UI-G03. Perubahan Class tidak otomatis menghapus membership/Skill tanpa keputusan G08.
- **Data/tes:** profiles, skills/user_skills, Storage; T03, T25, U14.

### UI-19 Badge Chest dan reward

**Dasar:** C1 koleksi badge, “Pilih 1 untuk ditampilkan di profil”, bank ikon; BADGE-01/RANK-01.

- Tampilkan badge yang benar-benar dimiliki: nama, tipe, konteks Career/Seasonal/Leaderboard, season/scope/posisi/populasi bila relevan, dan status equipped.
- Pilih satu badge milik sendiri untuk dipasang; setelah sukses profil ikut berubah. Badge season lama tetap dapat dipilih.
- Sertakan RANK_UP dan LEADERBOARD_POSITION; deskripsi C1 “badge posisi leaderboard” tidak menghapus tipe Rank-Up.
- Bank ikon adalah referensi aset, bukan pemberian seluruh badge kepada user. Badge nomor 54 hanya valid sesuai syarat Contender; tampilkan konteks/populasi.
- Sang Pemimpin dan Kolektor Kemenangan tetap OUTSIDE MVP. Tidak menambah tombol klaim yang memberi XP ulang; reward mengikuti transaksi/award server. Popup/notifikasi Rank-Up mengikuti RANK-01.
- **Data/tes:** badge_definitions, user_badges, equip_badge; T19, T21, U15.

### UI-20 Klaim Achievement

**Dasar:** C1 Nama Kompetisi, Penyelenggara, Tahun, Tier, Pencapaian, Sertifikat, Legacy XP 50%, Kirim/Batal; VAL-02.

- Nama kompetisi, penyelenggara, tanggal prestasi lengkap menggantikan Tahun saja, tier S/A/B/C, pencapaian Participant/Finalist/Juara 3/2/1, sertifikat.
- Tampilkan keterangan klaim kompetisi di luar Squad NEXUS dan Legacy XP 50%; jika preview disediakan, hitung dari XP-02 dan beri label belum disetujui.
- Kirim/Batal; PENDING setelah submit, alasan REJECTED dan resubmit ID sama, APPROVED menampilkan XP final. Jangan mengasumsikan semua achievement lama masuk Seasonal XP aktif.
- Sertifikat PDF/JPG/PNG maksimal 5.000.000 byte per file sesuai keputusan 8 Oktober 2026 (UI-G03); validasi file dan pemilik di server/Storage privat, database hanya menyimpan path.
- **Data/tes:** achievement_claims, xp_rules, ledger, Storage; T18, T25, U09.

### UI-21 Bagikan Profil

**Dasar:** C1 link profil, “Salin”, “Siapa pun dengan link ini bisa lihat profil publikmu”.

- Tampilkan link profil yang benar-benar didukung aplikasi dan aksi Salin; sukses hanya setelah clipboard berhasil, sediakan pesan jika gagal.
- Domain nexus.unesa.ac.id dan slug contoh bukan bukti hosting atau route /u/{slug} tersedia. Gunakan origin/route existing; strategi slug dan akses anon mengikuti UI-G08.
- Jangan mengumumkan “siapa pun” jika link masih memerlukan login. Data yang dibagikan adalah proyeksi profil publik, tanpa email/NIM/secret/chat atau dokumen bukti privat.
- **Data/tes:** route/profile projection yang diverifikasi; U16. Fitur tetap target, bukan klaim public access telah deployed.

### UI-22 Season History dan Mission History

**Dasar:** C1 section history di profil dan My Squad; LB-01/XP-01.

- Season History memuat season, Seasonal XP, Season Rank, posisi/populasi scope yang disimpan; bukan menghitung ulang sejarah memakai posisi live sekarang.
- Mission History memuat nama kompetisi, hasil, waktu dan XP aktual jika berhak; tautan detail hanya jika data/access tersedia.
- Klaim Achievement dan hasil Squad menjaga sumbernya masing-masing. Jika ditampilkan bersama, beri konteks sumber; jangan menduplikasi satu transaksi menjadi dua pencapaian.
- Lihat Selengkapnya memperluas/menavigasi riwayat yang benar; jumlah ringkasan dan pagination mengikuti pola existing atau keputusan UI-G10, bukan menyalin jumlah kartu Canva.
- **Data/tes:** season histories, approved result/claims, membership, ledger; T18, T26, U17.

### UI-23 Notifikasi

**Dasar:** C1 “Hari ini”, “Minggu Ini”, waktu relatif, recruitment, reward, Mission ditolak, cleanup; OPS-01.

- Daftar judul, isi, waktu dan status baca; pengelompokan waktu boleh mengikuti C1 dengan timezone konsisten. Keputusan UI 14 Oktober: notifikasi belum dibaca memiliki titik biru/border berbeda. Buka kartu untuk membaca isi; update hanya notifikasi tersebut dan hilangkan titik setelah penyimpanan berhasil. Tidak memakai tombol Tandai dibaca, tidak menandai data melalui GET/prefetch, dan tidak menandai seluruh daftar sekaligus.
- Jenis normatif: permintaan/hasil recruitment, hasil validasi Mission/achievement/result, Rank-Up/reward dan pembaruan laporan sesuai event yang benar-benar dibuat backend.
- Baca hanya notifikasi sendiri; perubahan user hanya is_read. Klik menuju objek terkait hanya bila pemetaan tujuan/data pendukung tersedia; UI-G09.
- Pesan “Klaim reward” tidak membuat pemberian reward manual baru. Peringatan cleanup H-3 tetap proposal; jangan tampilkan hitungan hapus otomatis jika scheduler/keputusan G07 belum siap.
- Kosong, gagal memuat, target notifikasi sudah tidak tersedia, dan perubahan status baca ditangani tanpa menandai semua data sebagai hilang.
- **Data/tes:** notifications, event handlers; U18.

### UI-24 Kebutuhan admin yang tidak terlihat lengkap di Canva

**Dasar:** PRD MIS-01, VAL-01/02, ADM-01, LB-01; bukan klaim ada desain admin lengkap C1.

- Review Mission: detail pengajuan/bukti, keputusan Tier, Approve/Reject dan alasan; min/max peserta mengikuti MIS-03.
- Review hasil/achievement: bukti, tier/hasil diajukan dan approved, preview XP final, Approve/Reject/alasan; reward hanya di backend.
- Penanganan laporan: detail, status, tindakan/handler; tidak memberi akses chat. Reopen/disband tetap G07.
- Pengelolaan master data/season mengikuti scope sumber dan izin admin; PRD UI ini tidak menetapkan sidebar, route, tombol hapus, atau workflow admin baru tanpa bukti.
- Form/daftar admin yang belum dirancang memerlukan rincian task tersendiri. Halaman yang tidak muncul di Canva tidak berarti requirement admin dihapus dari MVP.
- **Data/tes:** sumber entitas terkait, T04, T17–T18, T24, T26, U19.

## 18. Rekonsiliasi Canva dan keputusan UI

### 18.1 Aturan kanonik yang digunakan

| Konflik/contoh C1 | Keputusan yang dipakai | Acuan |
|---|---|---|
| Username login | Email mahasiswa; tidak membuat username baru | AUTH-01 |
| Skills tidak terbatas | Maksimal lima Skills | CLASS-01 |
| Daftar Class/typo tidak konsisten | Lima Class normatif dari master data; ejaan Researcher | CLASS-01 |
| Create: Skill max 5 | Requirement Primary Class dan slot tetap wajib; Skill tambahan belum diputuskan | SQ-02, UI-G02 |
| Klaim menggunakan Tahun | Tanggal prestasi lengkap | VAL-02 |
| 500 GOLD; 2450 PLATINUM | Hitung dari RANK-01: 500 Silver, 2450 Gold | RANK-01 |
| Verified · Gold pada Mission | Pisahkan Tier Mission S/A/B/C dari Rank pengguna | MIS-02 |
| Internal B-Rank dengan XP dasar 40 | Tier/XP dari data dan xp_rules; contoh bukan pemetaan normatif | XP-02 |
| 5/5 Open atau 3/4 Locked | Gunakan actual status; FULL/FINALIZED sama-sama Locked | SQ-01 |
| Bank ikon/nomor badge | Hanya badge yang diberikan dengan konteks/rule yang sah | BADGE-01 |
| Kolektor Kemenangan/Sang Pemimpin | OUTSIDE MVP | Bagian 2.3 |
| Kategori/Send Endorsement | Empat nilai 1–5 dalam konteks Squad completed | END-01 |
| Klaim reward pada notifikasi | Tidak mengkredit XP atau award ulang dari client | XP-01, RANK-01 |
| Peringatan cleanup 3 hari | Proposal, bukan automation deployed | G07, OPS-01 |
| Tanggal/XP/nama/count/chat contoh | Tidak hardcode; gunakan data riil yang berhak diakses | Bagian 17.1 |

### 18.2 Daftar keputusan UI terbuka

Status baris dapat berupa RESOLVED, DEFERRED, NEEDS DECISION, atau NOT VERIFIED sebagaimana dijelaskan. Tidak perlu menanyakan semua sekaligus; selesaikan hanya yang diperlukan task berjalan.

| ID | Hal yang belum tuntas | Batas agent |
|---|---|---|
| UI-G01 | Isi dropdown Filter C1 tidak terbaca lengkap | Pakai filter MIS-02; tambahan cakupan/sort bukan otomatis requirement |
| UI-G02 | Skill recruitment pada Create tidak ada dalam kontrak RPC | Jangan membuat field palsu yang tidak tersimpan atau mengubah RPC tanpa keputusan |
| UI-G03 | RESOLVED: Submit Hasil Mission (30 September 2026) satu sertifikat wajib dan satu dokumen pendukung opsional; Klaim Achievement (8 Oktober 2026) sertifikat PDF/JPG/PNG; maksimal 5.000.000 byte per file | Aturan klaim disepakati, tetapi implementasi bucket/policy klaim belum terverifikasi; bucket hasil Mission sudah dibatasi lewat migration 20260930115447. Batas avatar terpisah. |
| UI-G04 | DEFERRED 8 Oktober 2026: laporan masalah Squad ditunda | Jangan membangun dropdown/enum; jika fitur diaktifkan lagi, tentukan jenis masalah dan alur admin |
| UI-G05 | Countdown x/y hari, persentase 47%, awal periode belum didefinisikan | Deadline riil dapat tampil; jangan membuat progress pekerjaan atau rumus durasi baru |
| UI-G06 | RESOLVED 8 Oktober 2026: hanya Fakultas/Prodi sendiri, Universitas seluruh UNESA | UI menampilkan tiga scope tersebut; jangan membuka pilihan unit lain |
| UI-G07 | RESOLVED 15 Oktober: konteks Endorsement | Jalur My Squad membawa satu Squad shared yang divalidasi; jalur profil umum mempertahankan selector existing. Parameter URL tidak memberi eligibility baru. |
| UI-G08 | Share profile anon, domain, slug dan route | Verifikasi/putuskan akses publik dan data aman; jangan membuka seluruh profiles atau menjanjikan domain aktif |
| UI-G09 | Tujuan klik notifikasi dan badge unread | notifications tidak mencantumkan target ID/URL dalam kamus data; jangan parsing teks nama sebagai identitas objek atau mengarang schema |
| UI-G10 | Jumlah ringkasan, pagination, lokasi detail history/pengajuan | Ikuti komponen/route existing bila ada; angka contoh bukan batas produk |
| UI-G11 | My Finance, simbol tambah, ikon tanpa label, layar teks berulang | Kandidat template/dekorasi atau fungsi tak terbukti; tidak menjadi fitur baru tanpa konfirmasi |

FILE-01 tetap aturan privasi dan penyimpanan. Batas klaim 5 MB adalah keputusan produk, bukan klaim bucket/Storage klaim sudah diterapkan. Gap yang masih terbuka tetap berlaku dan tidak otomatis selesai karena UI didokumentasikan.

## 19. Acceptance UI seluruh halaman dan handoff

Semua Uxx berikut adalah **TARGET TEST / NOT RUN pada pembaruan dokumen ini**. Tes T01–T26 tetap berlaku. Cocokkan expected behavior dengan keputusan gap yang telah diselesaikan sebelum memberi PASS.

| ID | Cakupan | Bukti penerimaan |
|---|---|---|
| U01 | Navigasi, login, registrasi | Menu benar, email sebagai login, opsi akademik terkait, guard/session/role tepat; tidak ada halaman privat bocor |
| U02 | Onboarding | Lima Class valid, tepat satu dipilih, maksimal lima Skills, gagal simpan tidak melewati onboarding |
| U03 | Home | Career dan Seasonal terpisah, threshold benar, leaderboard scope benar, active Mission milik user; empty/no-season bukan dummy |
| U04 | Discovery/Add Mission | Search/filter/kartu sesuai data; expired/empty/error berbeda; pengajuan pending/reject/approve dan upload bekerja |
| U05 | Mission/Detail Squad | Filter Semua/Open/Locked benar; count dan anggota sesuai; completed tidak recruitment; akses data anggota aman |
| U06 | Create/Apply/Recruitment | Field Class/slot dan kapasitas benar; Apply hanya PENDING; Terima/Tolak/Cancel sesuai aktor, no duplicate saat retry |
| U07 | My Squad | Aktif/history/peran/hitungan lintas-Mission benar; XP history adalah milik user, tidak menghidupkan chat lama |
| U08 | Squad Room | Header/anggota/chat/aksi sesuai status dan peran; pending/error kirim jelas; revoked member/admin tidak membaca chat |
| U09 | Result dan Achievement | Pilihan hasil/tier tepat, tanggal lengkap legacy, preview belum award, upload tervalidasi; rejected resubmit ID sama |
| U10 | Intervention | Hanya eligible dapat lapor, involved member valid, status/alasan/tindakan benar, mahasiswa tidak mengubah status sendiri |
| U11 | Leaderboard | Scope/search/top3/list/rank/season konsisten; populasi kecil dan tie benar; klik profil user yang tepat |
| U12 | Profil | Semua section reputasi/history tampil sesuai data; self vs other berbeda; email/NIM/bukti privat tidak muncul |
| U13 | Endorsement | Empat rating valid, eligibility dan konteks Squad benar; no self/duplicate; rata-rata/jumlah hasil query benar |
| U14 | Edit Profil | Nama/bio/foto/Class/Skills tersimpan; forbidden fields tetap terlindungi; error mempertahankan input |
| U15 | Badge Chest | Hanya badge dimiliki, satu equipped, legacy season tetap tersedia, scope/populasi akurat, no title badge MVP |
| U16 | Share Profile | Link route nyata, clipboard sukses/gagal tepat, hak anon sesuai keputusan; tidak mengumbar data privat |
| U17 | History | Snapshot season tidak berubah karena leaderboard live; sumber achievement/result tidak diduplikasi |
| U18 | Notifikasi | Hanya milik user, read state benar, event nyata, tujuan valid atau fallback aman; no fake cleanup/reward |
| U19 | Admin | Review dan laporan sesuai izin; alasan reject, final XP dan status konsisten; no akses chat atau mutasi tak berizin |
| U20 | Semua layar | Loading/empty/error/sukses dapat dibedakan, keyboard/label dapat dipakai, submit ganda dicegah, tidak hardcode demo |

### 19.1 Checklist scope untuk AI agent

Untuk task UI, sebutkan UI-ID, requirement kanonik, data/function yang dibaca/ditulis, hak akses, kontrol dan pilihannya, state, gap yang relevan, serta T/U test yang akan dijalankan. Baca hanya sumber tambahan yang diperlukan; tautan Canva saja tidak menggantikan kontrak tekstual ini.

Jika UI existing kurang sesuai, identifikasi perbedaan lalu perbaiki dalam scope task. Jangan redesign seluruh aplikasi, menambah dependency, atau mengubah database hanya untuk meniru screenshot. Tidak ada kewajiban menyalin warna/font/layout/ikon C1. Seluruh halaman tetap tercakup dalam backlog produk meskipun pengerjaan dilakukan satu fitur setiap kali.

### 19.2 Changelog v1.1

- Menambahkan C1 sebagai sumber isi UI dan aturan otoritas tanpa mengubah business rule/deployment snapshot.
- Menambahkan UI-01–UI-24 untuk seluruh layar Canva dan kebutuhan PRD pendukung yang tidak ditampilkan lengkap di Canva.
- Menambahkan rekonsiliasi konflik dan UI-G01–UI-G11 agar pilihan yang belum terbukti tidak ditebak.
- Menambahkan U01–U20 untuk penerimaan UI; semuanya belum dijalankan dalam pembaruan dokumen ini.
- Mempertahankan nama file agar referensi docs/reference pada AGENTS.md tetap cocok. Pembaruan hanya dokumen; tidak ada code, schema, RLS, atau desain Canva yang diubah.

