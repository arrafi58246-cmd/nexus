# Join Squad Tahap B — Browser QA Checklist

Status: belum dijalankan.

## Setup

- [ ] Migration Tahap B dan structural checks sudah PASS.
- [ ] Gunakan akun applicant dan Ketua dedicated yang ACTIVE dan onboarding.
- [ ] Gunakan Mission/Squad disposable sebelum deadline; jangan gunakan atau
      mengubah email akun legacy yang melanggar `profiles_email_role_check`.
- [ ] DevTools Network tidak menunjukkan direct INSERT/UPDATE ke
      `squad_applications`; write hanya melalui RPC Server Action.

## Applicant cancel

- [ ] Card application sendiri menampilkan `Status aplikasi: Pending` dan aksi
      `Batalkan aplikasi Pending`.
- [ ] Klik ganda hanya menghasilkan satu request; tombol menampilkan
      `Membatalkan...` dan nonaktif selama request.
- [ ] Cancel sukses menampilkan feedback, kemudian refresh tetap menunjukkan
      aplikasi tidak Pending dan Join kembali sesuai eligibility terbaru.
- [ ] Cancel application yang telah diputuskan menampilkan error aman dan
      halaman refresh ke state database aktual.
- [ ] Applicant tidak melihat kontrol cancel milik user lain.

## Ketua decision

- [ ] Hanya card Squad milik Ketua menampilkan `Pelamar Pending`.
- [ ] Nama display dan Primary Class tampil; email, NIM, UUID user, dan field
      privat tidak tampil.
- [ ] `Terima` dan `Tolak` mempunyai keyboard focus yang terlihat, pending state,
      pencegah double-submit, dan feedback `aria-live`.
- [ ] Reject menghapus pelamar dari daftar setelah refresh dan tidak membuat
      membership.
- [ ] Accept membuat applicant menjadi member, membatalkan application Pending
      lain pada Mission yang sama, dan memperbarui daftar/card setelah refresh.
- [ ] Jika slot terakhir terisi, card berubah menjadi `Locked`/FULL.
- [ ] Ketua tidak dapat melihat atau memutuskan application Squad lain, termasuk
      melalui request yang dimodifikasi di DevTools.

## Error dan stale-state

- [ ] Deadline lewat: Accept nonaktif dengan alasan; request lama/manipulasi
      tetap ditolak database.
- [ ] Squad FULL/FINALIZED: Accept nonaktif, Reject tetap dapat menyelesaikan
      application Pending yang tersisa.
- [ ] Applicant SUSPENDED atau sudah memiliki membership ACTIVE: Accept gagal
      dengan pesan aman tanpa perubahan parsial.
- [ ] Dua tab yang memutuskan application sama menghasilkan satu keputusan;
      tab kalah refresh dan menampilkan state terminal.
- [ ] Gangguan jaringan tidak menampilkan stack, SQL, UUID internal, atau pesan
      database mentah.

## Cleanup

- [ ] Hapus seluruh fixture browser berdasarkan UUID yang dicatat.
- [ ] Verifikasi tidak ada Mission, Squad, application, membership, atau
      notification test yang tersisa.
