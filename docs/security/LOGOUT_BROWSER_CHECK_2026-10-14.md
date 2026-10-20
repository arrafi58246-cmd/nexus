# Logout dan pemeriksaan browser — 14 Oktober 2026

Baseline: main `b22aaad5c29907a4dd28a6618a29eb032888a5ef`.

## Temuan dan perubahan

Owner melaporkan avatar STUDENT/ADMIN hanya membuka Profil; navbar belum menyediakan logout.

- Navbar bersama sekarang menampilkan tombol **Keluar** untuk kedua role. Avatar tetap membuka Profil.
- `logout()` pada `src/lib/auth/logout-actions.ts` memakai server client existing dan `auth.signOut({ scope: "local" })`. Tidak menerima user ID/role dan tidak membaca database. Supabase menentukan sesi dari cookie request; Next melindungi origin Server Action.
- Setelah Auth berhasil, layout cache diinvalidasi. Client melakukan full navigation ke `/login`, membuang UI privat dan koneksi Realtime halaman lama.
- Request ganda ditahan; tombol menampilkan pending. Kegagalan Auth/network memberikan pesan aman dan dapat dicoba ulang, tanpa sukses palsu.
- Navbar mobile membungkus deretan aksi agar tombol tambahan tidak memperlebar halaman kecil.
- Tidak mengubah dependency, schema, RLS, akun, password, XP atau data proyek. Scope local hanya mencabut refresh sesi saat ini; access JWT yang sudah disalin tidak langsung kedaluwarsa.

## Bukti

| Pemeriksaan | Hasil dan batas |
|---|---|
| Owner: STUDENT | Home/Profil tetap tampil setelah F5; `/admin/results` ditolak 404. Dilaporkan 14 Oktober pada localhost, baseline di atas. |
| Owner: ADMIN | `/admin/results` tampil dan tetap tampil setelah F5; daftar review kosong. Screenshot dan laporan owner. |
| Suite aplikasi | 37 PASS, termasuk empat regression logout: error aman, sesi kosong, kontrol kedua role, SDK/cookie nyata. |
| SDK SSR asli | Auth HTTP lokal sintetis: POST logout scope local sekali, seluruh cookie sesi chunk terhapus dengan maxAge 0, cookie lain tetap, getUser tanpa sesi mengembalikan null; logout ulang tidak memanggil Auth. |
| HTTP production lokal | Navbar ADMIN menampilkan Keluar; Server Action aktual mengembalikan sukses dan Set-Cookie deletion; request admin sesudahnya tanpa cookie diarahkan ke login. Memakai fixture Auth lokal, bukan akun hosted/browser. |
| Lint/build | PASS, termasuk TypeScript. Tidak menjalankan dev server. |

## Masih harus dilakukan owner

Setelah pull dan rebuild, tes STUDENT lalu ADMIN: klik Keluar → login, buka ulang `/profile` atau `/admin/results` → login, login ulang → berhasil. Cek tombol pada layar mobile. Tes refresh singkat tidak membuktikan refresh token setelah expiry; alur Squad/approval/chat dan hosting masih terpisah.

Project Supabase existing akan digunakan untuk produksi sesuai keputusan owner. Tidak mengklaim environment testing terisolasi hanya karena aplikasi berjalan di localhost.

Referensi: [Supabase signOut](https://supabase.com/docs/reference/javascript/auth-signout), serta dokumentasi cookies, Server Actions dan revalidatePath pada Next 16.3.8 terpasang. Changelog Supabase diperiksa 14 Oktober.
