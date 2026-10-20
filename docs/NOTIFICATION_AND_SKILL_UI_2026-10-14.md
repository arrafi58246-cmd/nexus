# Notifikasi dan pilihan Skill — 14 Oktober 2026

Baseline: main `632aaeb455a5e9f3cb7feaf71ac20c35ecd11ff1` setelah tombol logout.

## Permintaan dan perubahan

- Ganti tombol Tandai dibaca dengan titik biru dan border pada notifikasi belum dibaca. Kartu memakai native details/summary, dapat dibuka melalui keyboard untuk membaca isi. Dot hilang setelah action sukses; gagal tetap unread dengan pesan error. Tutup/buka dapat mencoba ulang; toggle saat pending tidak membuat request tambahan.
- Validasi UUID lama kehilangan kelompok keempat, sehingga UUID standar ditolak. Pattern sekarang memakai lima kelompok 8-4-4-4-12.
- Action memverifikasi Auth, akun ACTIVE dan ownership, lalu mengubah hanya `is_read` pada satu ID unread. Jika tab lain sudah membacanya, lookup ownership memastikan retry idempotent. Tidak melakukan write saat GET/prefetch, bulk mark, polling atau re-fetch seluruh daftar setelah setiap klik.
- Dropdown tambah Skill hanya berisi Skill pada Primary Class pilihan yang belum dipilih. Ganti Class mengosongkan calon Skill dan menahan tambah sampai Simpan Class sukses. Batas lima tetap.
- Edit Profil lama memang membolehkan lintas-Class. Perubahan ini mempersempit pilihan UI; tidak menambah constraint database atau mengganti aturan backend secara diam-diam. Skill lama tetap terlihat dan dapat dihapus, termasuk dari Class berbeda; membership tidak diubah. G08 mengikuti batas ini.
- Tidak ada migration, dependency baru, perubahan akun/password atau cleanup data live.

## Verifikasi

| Pemeriksaan | Hasil / batas |
|---|---|
| Schema live readonly | notification_id UUID, user_id UUID, is_read boolean. Tidak mengubah baris hosted. |
| Suite aplikasi | 45 PASS: 37 sebelumnya + enam notification regression + dua Skill options. UUID invalid tanpa network, UUID standar diterima, auth/status/ownership, targeted update, retry, safe failure, markup dot/disclosure, pilihan Class dan Skill lama. |
| Lint/build | PASS termasuk TypeScript. Tidak menjalankan dev server. |
| React DOM lokal | Actual components + jsdom/synthetic actions: buka/tutup, pending duplicate guard, failure/retry, dot hilang; calon Skill reset, save gagal menahan add, save sukses mengubah pilihan, Skill lama tetap. Native toggle asynchronous pada harness menghasilkan warning act; assertion interaksi lulus. Bukan browser hosted atau pembuktian layout mobile. |
| HTTP production lokal | Auth/REST sintetis: HTML disclosure tanpa tombol manual; action UUID aktual menulis satu notifikasi milik owner, retry read sukses, foreign ditolak, sibling tetap unread, tidak re-fetch list saat action, reload mempertahankan flag. Bukan Supabase hosted. |

Owner sudah melaporkan logout STUDENT/ADMIN berhasil. Solo disband ikan sepat masuk riwayat Dibubarkan dengan 0/3 anggota, tanggal 14 Oktober; owner melaporkan reload aman. Owner mengklarifikasi pasti juara adalah Squad baru dan melaporkan create/Room/kirim chat berhasil. Screenshot chat yang terkirim sebenarnya masih history lama, sehingga bukti Room/chat adalah laporan owner; delivery dua akun/reconnect belum diuji.

## Pengujian owner berikutnya

1. Pull, rebuild dan restart. Buka Notifikasi: item unread memiliki dot. Buka satu kartu: isi tampil/dot hilang. F5: tetap read, item lain tetap unread. Tidak perlu membuat notifikasi baru hanya untuk tes.
2. Edit Profil: dropdown Skill hanya kelompok Class terpilih. Ganti Class tanpa menyimpan: calon Skill kosong, Tambah disabled. Simpan hanya bila memang ingin mengganti profil; Skill lama tetap sampai dihapus sendiri. Maksimal lima tetap.
3. Setelah UI aman, lanjut join/accept dan chat dua STUDENT pada Squad testing pasti juara. Environment menggunakan project existing calon produksi; jangan menyebut localhost sebagai database terisolasi.
