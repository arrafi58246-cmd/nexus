# NEXUS: kedekatan region aplikasi dan database

## Temuan sebelum perubahan

- Repository/production commit: `806887fc4d8b40518ed2c08831aeae9d972774c0`.
- Vercel production deployment `dpl_FVnxT9i2SM6g984MpTjNqucwYm9k` berstatus `READY`, region `iad1` (Washington, D.C.).
- Supabase Nexus Project berstatus `ACTIVE_HEALTHY`, region `ap-southeast-1` (Singapore).
- Home, profil, Missions, dan Leaderboard membaca session serta data melalui Supabase di server. Beberapa query sudah menggunakan `Promise.all`, tetapi tahap yang bergantung pada hasil sebelumnya tetap menambah perjalanan jaringan.
- Repository belum menetapkan region melalui `vercel.json` atau `preferredRegion`.

Jarak antarregion merupakan faktor latensi yang terverifikasi secara konfigurasi, bukan bukti bahwa seluruh kelambatan berasal darinya. Waktu akses login anonim dari lingkungan pemeriksaan bukan baseline pengalaman mahasiswa: respons merupakan cache HIT dan pengukuran mencakup jaringan pemeriksa.

## Perubahan

`vercel.json` menetapkan satu region Function, `sin1`, agar render halaman dinamis dan Route Handler dekat dengan Supabase. Satu region didukung paket Hobby. Konfigurasi ini berlaku pada deployment baru; tidak memindahkan database.

Perubahan ini tidak memodifikasi query, session guard, RLS, schema, Storage, isi data, atau UI. Proxy/Routing Middleware mengikuti penempatan platformnya sendiri; jangan menganggap `regions` memindahkan seluruh lapisan CDN/Proxy ke satu lokasi.

## Verifikasi

1. Validasi JSON terhadap schema resmi Vercel.
2. Jalankan CI repository pada PR: production dependency audit, lint, tes, dan build.
3. Pastikan deployment preview dari commit PR `READY` dan metadata region `sin1`.
4. Saat dirilis, pastikan alias produksi mengarah ke commit hasil merge dan metadata region `sin1`.
5. Bandingkan navigasi Home, Missions, Leaderboard, dan Profil memakai akun yang sama dari jaringan pengguna. Pisahkan muat pertama dan kunjungan ulang; laporkan waktu aktual sebelum mengklaim besaran peningkatan.

Browser interaktif pemeriksa mengalami timeout. Login mahasiswa, F5 sesi, navigasi setelah login, serta besaran peningkatan end-to-end belum diverifikasi dalam pemeriksaan awal ini. Tidak ada kredensial pengguna yang diminta atau diubah.

Rollback: revert commit konfigurasi ini lalu redeploy. Investigasi lanjutan bila masih lambat: ukur durasi request per halaman, identifikasi query yang masih saling menunggu, dan profilkan biaya render efek blur. Temuan kode tersebut belum menjadi izin untuk mengubah semua halaman sekaligus.

## Referensi

- https://vercel.com/docs/functions/configuring-functions/region
- https://vercel.com/docs/regions
- https://openapi.vercel.sh/vercel.json
