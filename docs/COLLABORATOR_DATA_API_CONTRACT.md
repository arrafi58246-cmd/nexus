# Kontrak data/API untuk collaborator NEXUS

Baseline: `main` commit `2245ac5bde38f45921019e369c7fe65df4a946de`, diperiksa 11 Oktober 2026. Kontrak berikut mendokumentasikan implementasi, bukan menambah endpoint atau izin. Bucket diperiksa langsung melalui metadata Supabase. Pemeriksaan ini tidak menjalankan ulang alur browser.

## Addendum 15 Oktober 2026 — Endorsement

- Entry utama: `/my-squad` → kartu Riwayat MISSION_COMPLETED →
  `/squads/[squadId]/endorsements` → `/profile/[userId]?squad=[squadId]`.
  Label kartu dan halaman adalah Detail Squad, memuat hasil approved, XP caller
  dari ledger serta daftar rekan. URL Room completed mengarah ke detail tanpa chat.
  Route daftar rekan memerlukan STUDENT ACTIVE/onboarded dengan riwayat membership;
  parameter profil hanya memilih konteks shared yang sudah eligible. Link baru
  memakai `prefetch={false}`; nama rekan dibaca sekaligus lewat public_profiles.

Pengajuan baru dibatasi 14 x 24 jam sejak `squads.completed_at` (approval hasil),
akhir eksklusif. Gunakan types/helper repository: `SharedSquad` menambahkan
`closesAt: string | null` dan `windowOpen: boolean`; sudah dinilai tetap ditampilkan.
`submitEndorsement` dapat mengembalikan `{ success: false, message, windowClosed: true }`;
refresh ketersediaan bila jendela tutup. INSERT langsung tetap diperiksa trigger.
Tidak ada endpoint, key, jumlah request tambahan atau kewajiban Realtime baru.

Koreksi roster 15 Oktober: UI/action mengambil peserta dari view read-only
`finalized_squad_members` (kolom `squad_id,user_id,status_member`, SELECT authenticated,
security_invoker mengikuti RLS tabel asal). Pemberi dan penerima harus anggota
pada waktu `finalized_at`, bukan sekadar pernah bergabung atau ACTIVE sekarang.
Keluar sebelum/tepat finalisasi dan join sesudahnya dikecualikan; removal sesudah
finalisasi tetap tercatat. Guard INSERT menegakkan aturan yang sama. Detail history
tetap dapat dibaca mantan anggota, tanpa tombol menilai bila bukan peserta final.

## Addendum 13 Oktober 2026

- Pembubaran solo: impor `disbandSoloSquad` dari `@/app/squads/[squadId]/disband-actions`; input satu UUID squadId, output MembershipActionResult `{success:true}` atau `{success:false,message}`. STUDENT ACTIVE/onboarded, Ketua solo sebelum FINALIZED. PENDING pada Squad CANCELLED dengan notifikasi; DISBANDED/history dan membership LEFT tersimpan atomic. Refresh biasa, tanpa realtime baru. Detail: [solo disband](SOLO_SQUAD_DISBAND_2026-10-13.md).

- Kontrak baseline di bawah tetap referensi historis; status terkini ada di [rencana rilis](RELEASE_PLAN_2026-10-18.md).
- Server Action baru: impor `transferSquadLeadership` dari `@/app/squads/[squadId]/actions`; panggil `await transferSquadLeadership(squadId, newLeaderId)`. Kedua parameter UUID string dari data sebenarnya. Hasil: `{success:true}` atau `{success:false,message:string}`; gunakan `MembershipActionResult` pada module types Squad. Ini Server Action, bukan endpoint GET/PATCH baru.
- Akses transfer: STUDENT ACTIVE yang menjadi Ketua pada Squad OPEN_RECRUITMENT/FULL; pengganti ANGGOTA ACTIVE dengan akun STUDENT ACTIVE. Diri sendiri/nonmember/Finalized ditolak. Setelah berhasil Ketua lama menjadi anggota dan boleh leave. Revalidation/refresh biasa pada Room, My Squad, Mission dan Home; tidak memerlukan Realtime baru.
- Create Squad kini membatalkan application PENDING milik pembuat pada Mission yang sama secara atomic. Input/return action tetap; application user lain atau Mission lain tidak berubah.
- LoginForm memakai `loginWithProfile` dari `src/lib/auth/login.ts` untuk login, pemeriksaan profil/role/status, cleanup sesi gagal dan pemilihan tujuan. Pakai helper existing; jangan melewati pemeriksaan profil setelah login SDK.
- Owner melaporkan QA login/avatar dan tiga bucket dokumen PASS. Tes tersebut belum membuktikan cookie/browser, upload melalui form, approval admin atau realtime gabungan frontend.
- Remediasi RLS/ACL tidak membuat bucket dokumen publik atau menambah key frontend. Env tetap URL project dasar dan publishable key; service_role/secret tidak dibagikan.

## Mulai bekerja

Baca [CONTRIBUTING](../CONTRIBUTING.md), [AGENTS](../AGENTS.md), dan [PRD](reference/NEXUS_PRD_UNIFIED.md). Jalankan `npm ci`, isi `.env.local` dengan `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` dari owner, lalu `npm run dev`. Jangan commit kredensial. Akses repo tidak otomatis memberi akses dashboard Supabase atau role ADMIN aplikasi.

- Gunakan client existing di `src/lib/supabase/{client,server}.ts`.
- Server Action diimpor dari module existing; jangan membuat URL REST berdasarkan nama action atau mengandalkan URL transport internal Next.js.
- API aplikasi menggunakan sesi cookie. Contoh `fetch` di bawah dijalankan dari aplikasi pada origin yang sama. Jangan mengatur sendiri boundary `Content-Type` untuk FormData.
- ID UUID adalah string; ID master Class/Skill/Tier adalah number. Ambil ID master dari data, bukan mengasumsikan nomor tertentu.
- `STUDENT siap` di dokumen ini berarti role STUDENT, akun ACTIVE, onboarding selesai. Ketua adalah peran Squad, bukan role aplikasi baru. RLS dan guard database tetap berlaku.
- Error bisnis Server Action ada di hasil return, bukan kontrak HTTP status. Tangani juga kegagalan transport dengan `try/catch`. Jangan parsing teks `message` sebagai enum.

## API HTTP

Semua POST upload sukses dengan HTTP 200. Bentuk error upload adalah `{ success: false, message: string }`; Mission dapat menyertakan `fieldErrors`. Status: 400 input/file tidak valid, 401 sesi tidak valid, 403 akses/origin ditolak, 409 konflik/simpan gagal, 413 batas request terlampaui, 503 pemeriksaan data atau upload gagal. Batas file individual yang dilanggar biasanya menghasilkan 400, bukan 413.

| Method dan endpoint | Input | Sukses | Akses dan syarat |
|---|---|---|---|
| POST `/api/profile/avatar` | FormData `avatar: File atau path`, tepat satu | `{success:true}` | Pemilik profil ACTIVE; STUDENT harus selesai onboarding; origin wajib |
| POST `/api/missions/submissions` | FormData field Mission di bawah, `dokumen: File atau path`, opsional `submission_id: UUID`; direct upload baru memakai `upload_id:UUID` | `{success:true, submissionId:string}` | STUDENT siap; ID lama harus milik sendiri dan REJECTED |
| GET `/api/missions/suggestions?name=...` | Nama di-trim, panjang 3–100 | `{matches: Array<{nama_lomba,penyelenggara,tahun_lomba}>}` | Authenticated, hasil dibatasi RLS; gabungan maksimal 5 Mission dan 5 pengajuan sendiri |
| POST `/api/achievement-claims` | FormData `nama_kompetisi`, `penyelenggara`, `achievement_date`, `submitted_tier_id`, `hasil_kompetisi`, `sertifikat:File atau path`; opsional `claim_id:UUID`; direct upload baru memakai `upload_id:UUID` | `{success:true, claimId:string}` | STUDENT siap; kirim ulang hanya klaim sendiri REJECTED |
| POST `/api/squads/[squadId]/result` | FormData `hasil_kompetisi`, `submitted_tier_id`, `sertifikat:File atau path`; opsional `dokumen_pendukung:File atau path` | `{success:true}` | STUDENT siap, Ketua dan membership ACTIVE, Squad FINALIZED; hasil lama hanya REJECTED |
| POST `/api/squad-applications/submit` | JSON `{squadId:string}` | HTTP 201 `{success:true, applicationId:string}` | Sesi eligible menurut action/RPC, onboarding selesai, recruitment terbuka; origin wajib |

Suggestions: nama di luar panjang valid menghasilkan HTTP 200 `{matches:[]}` sebelum pemeriksaan sesi. Untuk nama valid: 401 bila sesi gagal, 503 bila query gagal, keduanya `{matches:[]}`. Hasil bukan bukti bahwa nama boleh dipakai; unique constraint masih berlaku.

Join memakai `SubmitSquadApplicationResult` dari `src/app/missions/[missionId]/actions.ts`. Error `{success:false,code,message}`:

| HTTP | Code/kondisi |
|---|---|
| 400 | `INVALID_INPUT` |
| 401 | `AUTH_REQUIRED` |
| 403 | `ACCOUNT_INACTIVE`, `ONBOARDING_REQUIRED`, `OWN_SQUAD`; origin ditolak memakai `DATABASE_ERROR` generik |
| 404 | `SQUAD_NOT_FOUND`, `MISSION_NOT_FOUND` |
| 409 | `SQUAD_LOCKED`, `MISSION_REGISTRATION_CLOSED`, `ACTIVE_MEMBERSHIP`, `DUPLICATE_PENDING`, `PENDING_LIMIT_REACHED` |
| 415 | Content-Type bukan JSON, code `INVALID_INPUT` |
| 500 | `DATABASE_ERROR`, termasuk JSON malformed yang tertangkap handler |

### Upload untuk hosting Vercel (15 Oktober)

Form frontend memakai `submitWithUploads` dari `src/lib/uploads/submit-with-uploads.ts`.
Helper mengunggah File langsung ke Supabase memakai sesi caller dan mengganti field
file menjadi path sebelum POST. Pemilik folder diverifikasi server; path bukan URL
atau signed URL. Untuk Mission/klaim baru, helper membuat `upload_id` yang menjadi ID
record baru. Untuk resubmit, kirim ID lama dan pakai ID yang sama sebagai argumen
folder helper. Hasil Squad memakai `squadId`; avatar hanya folder user.
Server membaca ulang isi file dan menjalankan validator existing. Bentuk respons,
role dan ukuran produk tetap. Multipart File tetap didukung backend untuk
kompatibilitas, tetapi melampaui batas payload 4,5 MB Vercel akan ditolak host.

### Field Mission

Semua field berikut wajib; nilai FormData berupa string kecuali `dokumen`:

| Field | Validasi |
|---|---|
| `nama_lomba`, `penyelenggara` | Nonkosong, maksimal 200 karakter setelah trim |
| `link_resmi` | HTTP/HTTPS, maksimal 2048 karakter |
| `deskripsi_singkat` | Nonkosong, maksimal 3000 karakter |
| `deadline_pendaftaran`, `deadline_lomba` | ISO UTC lengkap, misalnya `2027-01-15T10:00:00.000Z`; pendaftaran harus di masa depan; lomba tidak sebelum pendaftaran |
| `tahun_lomba` | Empat digit, 1000–9999 |
| `min_anggota_tim`, `max_anggota_tim` | Integer 2–32767, max >= min, termasuk Ketua |
| `kategori_penyelenggara`, `kategori_lomba`, `cakupan_peserta`, `mode_lomba`, `biaya_pendaftaran` | Gunakan constants di `src/app/missions/add/options.ts` |
| `dokumen` | File PDF/JPG/PNG asli, maksimal 10 MiB |

Klaim: nama/penyelenggara nonkosong maksimal 200 karakter; `achievement_date` tanggal kalender `YYYY-MM-DD`, tidak melewati tanggal UTC hari ini. Tier harus integer positif dengan aturan XP tersedia. `hasil_kompetisi` pada klaim/hasil memakai `RESULT_OPTIONS`: `PARTICIPANT`, `FINALIST`, `JUARA_3`, `JUARA_2`, `JUARA_1`. Jangan mengirim preview XP dari client; server menghitungnya.

### Contoh request dan response HTTP

Contoh memakai variabel ID/File dari UI dan data master yang sudah dimuat. Jangan menjalankannya massal di produksi.

```ts
import { submitWithUploads } from "@/lib/uploads/submit-with-uploads";

// Avatar → 200 { success: true }
const avatarForm = new FormData();
avatarForm.set("avatar", avatarFile);
await submitWithUploads("/api/profile/avatar", avatarForm, "avatars", ["avatar"]);

// Suggestions → 200 { matches: [{ nama_lomba: "Lomba Demo",
//   penyelenggara: "Kampus Demo", tahun_lomba: 2027 }] }
await fetch(`/api/missions/suggestions?name=${encodeURIComponent("Lomba")}`);

// Join → 201 { success: true, applicationId: "<UUID hasil server>" }
await fetch("/api/squad-applications/submit", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ squadId }),
});
// Contoh 409: { success:false, code:"DUPLICATE_PENDING", message:"..." }

// Mission → 200 { success: true, submissionId: "<UUID hasil server>" }
const missionForm = new FormData();
const mission = {
  nama_lomba: "QA Lomba Demo", penyelenggara: "Kampus Demo",
  kategori_penyelenggara: "UNIVERSITAS_LOKAL_INTERNAL",
  link_resmi: "https://example.com/competition",
  deadline_pendaftaran: futureRegistrationDate.toISOString(),
  deadline_lomba: futureCompetitionDate.toISOString(),
  tahun_lomba: String(futureCompetitionDate.getUTCFullYear()),
  kategori_lomba: "TECHNOLOGY", cakupan_peserta: "INTERNAL",
  mode_lomba: "ONLINE", biaya_pendaftaran: "GRATIS",
  min_anggota_tim: "2", max_anggota_tim: "3",
  deskripsi_singkat: "Data pengujian yang disetujui owner.",
};
for (const [key, value] of Object.entries(mission)) missionForm.set(key, value);
missionForm.set("dokumen", posterFile);
await submitWithUploads("/api/missions/submissions", missionForm, "mission-documents", ["dokumen"]);
// Resubmit: set submission_id dan berikan ID itu sebagai argumen folder terakhir.
// Contoh 400: { success:false, message:"Periksa kolom yang ditandai.",
//   fieldErrors:{ dokumen:"Berkas harus PDF/JPG/PNG asli, maksimal 10 MiB." } }

// Klaim → 200 { success:true, claimId:"<UUID hasil server>" }
const claimForm = new FormData();
claimForm.set("nama_kompetisi", "QA Lomba Demo");
claimForm.set("penyelenggara", "Kampus Demo");
claimForm.set("achievement_date", "2026-09-01");
claimForm.set("submitted_tier_id", String(selectedTierId));
claimForm.set("hasil_kompetisi", "PARTICIPANT");
claimForm.set("sertifikat", certificateFile);
await submitWithUploads("/api/achievement-claims", claimForm, "achievement-certificates", ["sertifikat"]);
// Resubmit: set claim_id dan berikan ID itu sebagai argumen folder terakhir.

// Hasil Squad → 200 { success:true }
const resultForm = new FormData();
resultForm.set("submitted_tier_id", String(selectedTierId));
resultForm.set("hasil_kompetisi", "PARTICIPANT");
resultForm.set("sertifikat", certificateFile);
if (supportingFile) resultForm.set("dokumen_pendukung", supportingFile);
await submitWithUploads(`/api/squads/${squadId}/result`, resultForm,
  "mission-result-certificates", ["sertifikat", "dokumen_pendukung"], squadId);
// Contoh error upload umum: 401 { success:false, message:"Silakan login kembali." }
```

## Server Actions

`OK` dalam tabel berarti `{success:true}`; `ERR` berarti `{success:false,message:string}`. Semua contoh adalah pemanggilan action yang sudah diimpor dari file terkait. ID contoh adalah variabel dari data sebenarnya. Semua action menggunakan refresh/revalidation biasa, kecuali penerimaan pesan chat memakai Realtime.

| File di `src/app/` | Action dan contoh input | Respons | Akses/syarat/error utama |
|---|---|---|---|
| `onboarding/actions.ts` | `completeOnboarding(classId, skillIds)` | OK, opsional `alreadyCompleted:true`; ERR | Sesi dan profil tersedia; Class positif; maksimal 5 Skill unik dari Class pilihan. Action tidak mengecek role/status secara eksplisit; akses DB tetap berlaku |
| `profile/edit/actions.ts` | `updateProfileBasics("Nama", "Bio")` | OK / ERR | Profil sendiri ACTIVE; STUDENT selesai onboarding; nama wajib, bio kosong disimpan null |
| `profile/edit/academic-actions.ts` | `updatePrimaryClass(classId)` | OK / ERR | STUDENT siap, Class harus ada |
| file yang sama | `addProfileSkill(skillId)` | OK / ERR | STUDENT siap; Skill ada, maksimal 5, tidak duplikat; tidak memaksa Class Skill sama pada action ini |
| file yang sama | `removeProfileSkill(skillId)` | OK / ERR | STUDENT siap, Skill milik sendiri |
| `profile/badges/actions.ts` | `equipBadge(userBadgeId)` | OK / ERR | STUDENT siap, UUID record **user_badges**, harus dimiliki; sudah equipped idempotent |
| `profile/[userId]/actions.ts` | `submitEndorsement(targetUserId, squadId, {communication:4, contribution:5, teamwork:4, responsibility:5})` | OK / ERR | STUDENT siap, bukan diri sendiri, sama-sama anggota saat finalisasi Squad MISSION_COMPLETED; jendela 14 hari; integer 1–5; duplikat ditolak |
| `notifications/actions.ts` | `markNotificationRead(notificationId)` | OK / ERR | Akun ACTIVE, notifikasi sendiri yang belum dibaca; sudah read menghasilkan error muat ulang |
| `missions/[missionId]/actions.ts` | `createSquad({missionId,namaSquad:"Tim Demo",deskripsiSquad:"Deskripsi",kapasitasAnggota:3,requirements:[{primaryClassId:classId,slots:2}]})` | `{success:true,squadId}` atau `{success:false,code,message}` | Student eligible; deadline terbuka, kapasitas sesuai Mission, total slot = kapasitas - Ketua; gunakan `CreateSquadInput/Result` |
| file yang sama | `submitSquadApplication(squadId)` | `{success:true,applicationId}` atau `{success:false,code,message}` | Sama dengan API Join; maksimal 3 PENDING dan satu membership ACTIVE per Mission |
| file yang sama | `cancelSquadApplication(applicationId)` | OK atau `{success:false,code,message}` | Pemohon, application masih PENDING; gunakan `SquadApplicationMutationResult` |
| file yang sama | `decideSquadApplication(applicationId,"ACCEPTED")` atau `"REJECTED"` | OK atau `{success:false,code,message}` | Ketua terkait; eligibility, deadline, kapasitas dan konflik diperiksa; jangan mengubah membership langsung dari UI |
| `squads/[squadId]/actions.ts` | `leaveSquad(squadId)` | OK / ERR | STUDENT ACTIVE, ANGGOTA aktif; status OPEN_RECRUITMENT/FULL |
| file yang sama | `kickSquadMember(squadId,memberUserId)` | OK / ERR | STUDENT ACTIVE, Ketua terkait; target ANGGOTA aktif bukan diri sendiri, status OPEN_RECRUITMENT/FULL |
| file yang sama | `finalizeSquad(squadId)` | OK / ERR | STUDENT ACTIVE, Ketua; OPEN_RECRUITMENT/FULL, jumlah anggota aktif memenuhi minimum Mission |
| file yang sama | `sendSquadMessage(squadId,"Halo tim")` | OK / ERR | Membership ACTIVE; RLS memeriksa akun/status Squad; trim, 1–2000 karakter. ADMIN tidak boleh membaca chat |
| `admin/missions/actions.ts` | `reviewMission(submissionId,"APPROVED",tierId,null,2,3)`; reject: `(submissionId,"REJECTED",null,"Alasan",null,null)` | OK / ERR | ADMIN ACTIVE; PENDING; approval memeriksa deadline, dokumen, tier, duplikat dan rentang tim; alasan reject maksimal 1000 |
| `admin/results/actions.ts` | `reviewMissionResult(resultId,"APPROVED",tierId,"PARTICIPANT",null)`; reject: `(resultId,"REJECTED",null,null,"Alasan")` | OK / ERR | ADMIN ACTIVE; PENDING; tier/hasil valid; alasan reject maksimal 1000 |
| `admin/achievements/actions.ts` | `reviewAchievement(claimId,"APPROVED",tierId,null)`; reject: `(claimId,"REJECTED",null,"Alasan")` | OK / ERR | ADMIN ACTIVE; PENDING; sertifikat tersedia, aturan XP valid; alasan reject maksimal 1000 |

Daftar error code Create/Join/Decision lengkap ada di `src/app/missions/[missionId]/mission-actions/types.ts`. Gunakan discriminant `success`; jangan menambahkan asumsi bahwa semua error memiliki `code`. Action lain memakai pesan aman tanpa code.

```ts
import { createSquad, type CreateSquadInput } from "@/app/missions/[missionId]/actions";
const input: CreateSquadInput = {
  missionId, namaSquad: "Tim Demo", deskripsiSquad: "Deskripsi",
  kapasitasAnggota: 3, requirements: [{ primaryClassId: classId, slots: 2 }],
};
const response = await createSquad(input);
if (!response.success) {
  // Contoh: {success:false,code:"MISSION_REGISTRATION_CLOSED",message:"..."}
  showError(response.message);
} else {
  // {success:true,squadId:"<UUID hasil server>"}
  router.push(`/squads/${response.squadId}`);
}
```

## Pembacaan data, Auth, dan types

Halaman banyak memuat data langsung melalui Supabase di Server Component; tidak ada janji endpoint `/api/profile`, `/api/missions`, atau `/api/leaderboard`. Ikuti query dan transformasi `page.tsx` existing serta RLS; props tampilan tidak selalu identik dengan row database.

| Fitur | Sumber kontrak yang dipakai ulang |
|---|---|
| Auth | `src/components/auth/LoginForm.tsx`: `auth.signInWithPassword({email,password})`; register di `src/components/auth/register/RegisterForm.tsx`: `auth.signUp({email,password,options:{data:{nama_lengkap,nim,program_studi_id,tahun_masuk,accepted_terms_at}}})`. Respons SDK `{data,error}`; session registrasi bisa null, jangan menganggap selalu langsung login |
| Discovery/Detail Mission | `src/app/missions/page.tsx`, `[missionId]/page.tsx`; types `[missionId]/mission-detail/types.ts` |
| Form Mission | `src/app/missions/add/options.ts` dan `validation.ts`: enums, `MissionSubmission`, `MissionFieldErrors` |
| Squad/My Squad | `src/app/my-squad/types.ts`; status OPEN_RECRUITMENT, FULL, FINALIZED, MISSION_COMPLETED |
| Room/Chat | `src/app/squads/[squadId]/types.ts`: `RoomMember`, `RoomMessage`, `SendMessageResult` |
| Hasil/Klaim | `src/app/squads/[squadId]/result/types.ts` dan `src/app/profile/claims/types.ts` |
| Leaderboard | `src/app/leaderboard/types.ts`: `Scope`, `LeaderboardEntry`; RPC `get_current_leaderboard` dipanggil di `page.tsx` |
| History/Endorsement | `src/lib/mission-history.ts`, `season-history.ts`, `endorsements.ts` |

Contoh login: `await supabase.auth.signInWithPassword({email,password})`; baca `error` dahulu sebelum `data.user`/`data.session`. Contoh response tampilan chat: `{message_id:"<UUID>",sender_id:"<UUID>",content:"Halo tim",created_at:"2026-10-11T10:00:00Z"}`. Itu `RoomMessage`, bukan response action kirim pesan.

Untuk return type action yang tidak diekspor, gunakan `Awaited<ReturnType<typeof action>>` jika perlu; jangan menggandakan definisi. Types fitur belum merupakan satu kontrak generated Database yang lengkap.

## Realtime atau refresh

- Chat memakai subscription `postgres_changes` INSERT pada `public.squad_messages`, filter `squad_id=eq.<squadId>`, channel `squad-messages-<squadId>` di `SquadChat.tsx`.
- Tidak ada subscription DELETE di komponen itu. Cleanup pesan lama baru tercermin melalui reload/refetch; jangan mengklaim penghapusan realtime.
- Mission, applications, profil, badge, hasil, klaim, notifikasi, leaderboard dan history memakai load/refresh biasa. Mutation existing melakukan revalidation pada path terkait; frontend ikuti refresh/navigation komponen existing.
- XP hanya masuk dari approval tervalidasi. Leaderboard nomor 1 tidak otomatis berarti badge sudah diberikan: award mingguan adalah proses terpisah. Jangan membuat XP/badge optimistik di client.

## Storage: diverifikasi live 11 Oktober 2026

| Bucket | Kegunaan | Batas per file | MIME | URL |
|---|---|---|---|---|
| `avatars` | Foto profil | 5.242.880 byte (5 MiB) | image/jpeg, image/png, image/webp | Public; UI memakai `getPublicUrl` |
| `mission-documents` | Poster/dokumen pengajuan Mission | 10.485.760 byte (10 MiB) | application/pdf, image/jpeg, image/png | Private; review admin memakai signed URL 300 detik |
| `achievement-certificates` | Sertifikat klaim prestasi | 5.000.000 byte (5 MB) | application/pdf, image/jpeg, image/png | Private; review admin memakai signed URL 300 detik |
| `mission-result-certificates` | Sertifikat dan dokumen pendukung hasil Squad | 5.000.000 byte (5 MB) masing-masing | application/pdf, image/jpeg, image/png | Private; review admin memakai signed URL 300 detik |

Validasi server memeriksa MIME dan signature file. Tidak ada batas dimensi pixel tambahan pada validator yang diperiksa. Jangan menerima SVG/GIF berdasarkan ekstensi saja. Simpan path object, bukan signed URL yang kedaluwarsa. Bucket public avatar tidak berarti semua orang boleh upload/ubah avatar.

Path dibentuk helper browser (atau server untuk multipart File lama) dan diverifikasi server: avatar `<userId>/<randomUUID>.<ext>`; Mission/klaim `<userId>/<submissionId atau claimId>/<randomUUID>.<ext>`; hasil `<userId>/<squadId>/<randomUUID>-certificate.<ext>` atau `-supporting.<ext>`. Gunakan helper upload existing; owner berasal dari sesi, status review tetap ditetapkan backend. Tidak ada bucket poster public terpisah yang ditemukan; jika desain meminta poster public, itu perubahan kontrak yang perlu dibahas.

## Seed/demo data dan izin testing

- Tidak ditemukan `supabase/seed.sql`, konfigurasi seed lokal, atau script seed demo lengkap dalam repo baseline. Migration dan SQL tes di `supabase/tests/` bukan jaminan proyek kosong dapat langsung dibangun ulang dengan semua master data dan akun demo.
- Data QA yang pernah dibuat tidak boleh dianggap fixture stabil atau akun bersama. Mintalah owner menentukan akun dan environment uji; jangan membagikan password akun personal.
- **Izin collaborator membuat data testing belum ditetapkan dalam handoff ini.** Owner perlu menentukan environment, akun, fitur yang boleh diuji, dan siapa yang membersihkan data/file. Akses repo saja bukan izin menulis atau menghapus data produksi.
- Usulan untuk disepakati: gunakan environment uji; data diberi label QA dan ID dicatat, gunakan berkas sintetis, bersihkan hanya data milik pengujian yang sudah selesai. Approval hasil/achievement berdampak XP, badge, dan history sehingga tidak cocok dijalankan sembarang di produksi.

## Pembagian kerja pertama

Owner memberikan satu fitur kecil beserta halaman yang dikerjakan, acceptance criteria, environment dan akun uji. Collaborator menggunakan kontrak/types existing, membuat branch dan PR sesuai CONTRIBUTING. Perubahan input, respons, enum, hak akses, atau Storage harus menyertakan pembaruan dokumen ini. Jangan mengubah schema/RLS hanya untuk menyelesaikan layout.

Baseline handoff 11 Oktober memeriksa handler/action/types dan metadata bucket tanpa mengubah runtime. Pembaruan 15 Oktober mengikuti implementasi direct upload pada PR yang sama; bukti sintetis dan batas verifikasi hosted tercatat di [runbook Vercel](VERCEL_HOBBY_DEPLOY_2026-10-15.md). Tidak ada perubahan data pengguna, schema atau permission pada pembaruan ini.
