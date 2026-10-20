# Join Squad Tahap B — Concurrency Test Plan

Status: belum dijalankan. Jalankan hanya setelah migration Tahap B dan
structural checks PASS pada environment remote yang diizinkan.

## Prasyarat aman

- Gunakan UUID akun tes dedicated yang ditulis eksplisit: dua Ketua ACTIVE,
  dua applicant ACTIVE, semuanya sudah onboarding dan bukan akun pengguna real.
- Jangan mencari akun otomatis dari `profiles`.
- Buat Mission, Squad, dan application disposable dengan UUID/nama berprefix
  `JOIN-B-CONCURRENCY` agar cleanup dapat diverifikasi tepat sasaran.
- Fixture harus terlihat oleh kedua sesi, sehingga setup perlu di-commit.
  Catat seluruh UUID sebelum mulai dan lakukan cleanup eksplisit setelah test.
- Pada setiap sesi gunakan `lock_timeout = '10s'` dan
  `statement_timeout = '30s'`. Timeout/deadlock adalah FAIL, bukan hasil yang
  boleh diabaikan.

## C1 — Dua ACCEPT untuk applicant sama, Squad berbeda

1. Buat dua application PENDING milik applicant yang sama pada Mission sama,
   masing-masing ke Squad A dan Squad B.
2. Session A dan Session B memanggil `decide_squad_application(...,
   'ACCEPTED')` secara bersamaan untuk application berbeda.
3. Expected:
   - tidak ada SQLSTATE `40P01`;
   - tepat satu application `ACCEPTED` dan satu `CANCELLED`;
   - tepat satu membership `ANGGOTA/ACTIVE` untuk applicant pada Mission;
   - keputusan yang kalah ditolak sebagai application bukan lagi PENDING;
   - tidak ada membership atau notification parsial dari transaksi yang gagal.

## C2 — Dua applicant memperebutkan slot terakhir Squad sama

1. Sisakan tepat satu slot pada Squad OPEN dan buat dua application PENDING.
2. Kedua Ketua/session menerima application berbeda secara bersamaan.
3. Expected:
   - Squad row lock menyerialisasi kedua request;
   - jumlah member ACTIVE tidak pernah melebihi `kapasitas_anggota`;
   - tepat satu applicant diterima;
   - Squad berakhir `FULL`;
   - request yang kalah mendapat error non-OPEN/full tanpa write parsial.

## C3 — Cancel dan decision pada application sama

1. Applicant menjalankan `cancel_squad_application` sementara Ketua menjalankan
   `decide_squad_application` pada application PENDING yang sama.
2. Expected:
   - application row lock membuat satu request menang;
   - request kedua ditolak karena status bukan lagi PENDING;
   - tepat satu terminal state dan decision timestamp yang valid;
   - jika ACCEPT menang, membership dan perubahan Squad tetap atomic.

## C4 — Submit bersamaan dengan ACCEPT applicant yang sama

1. Ketua menerima application applicant pada Squad A saat applicant mengirim
   application baru ke Squad B pada Mission sama.
2. Expected:
   - tidak ada deadlock antara urutan application → Squad → Mission → profile;
   - hasil akhir mempunyai paling banyak satu membership ACTIVE;
   - application baru ditolak karena membership atau ikut auto-cancel sesuai
     urutan commit;
   - tidak ada application PENDING yang melanggar keadaan membership final.

## Verifikasi dan cleanup

Query hasil berdasarkan UUID fixture saja. Verifikasi count application,
membership, member Squad, status Squad, dan notification. Hapus hanya fixture
yang UUID-nya dicatat, lalu jalankan query `NOT EXISTS` untuk setiap Mission,
Squad, application, membership, dan notification test. Simpan output kedua sesi
beserta timestamp sebagai bukti runtime.
