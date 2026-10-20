# SSR session dan env readiness — 13 Oktober 2026

Baseline: main `15f0d16ccb51b920ce22a73d923a777cb649c54e` setelah integrasi frontend.

## Masalah dan perubahan

Client server sudah membaca cookie, tetapi repository belum memiliki Proxy untuk menyimpan cookie refresh ke browser sebelum Server Component render. Penulisan cookie dari Server Component ditangkap sebagai error, sehingga refresh di tempat itu tidak cukup untuk mempertahankan sesi pada request berikutnya.

- `src/proxy.ts` memakai convention Next 16 dan helper `src/lib/supabase/proxy.ts`.
- Helper memverifikasi/refresh melalui `getClaims`, meneruskan cookie baru ke request Server Components dan response browser, serta mempertahankan cookie chunk/deletion/options dan cache headers dari SSR SDK.
- Request tanpa cookie sesi melewati refresh tanpa panggilan Auth tambahan. Aset statis dikecualikan matcher.
- Proxy tidak menetapkan role/akses atau membuat redirect baru. Guard page/action melalui `getUser`/profil dan RLS existing tetap menentukan akses.
- Pemeriksaan `npm run qa:environment` mendeteksi URL dasar yang salah, placeholder, key rahasia pada NEXT_PUBLIC dan konfigurasi kosong. Tidak mencetak nilai key atau melakukan request jaringan.
- `.env.example` hanya berisi placeholder. Legacy anon didukung dengan catatan; konfigurasi baru tetap memakai publishable key.

## Verifikasi

| Pemeriksaan | Hasil / batas |
|---|---|
| npm test | 27 PASS: 19 sebelumnya + 4 cookie/matcher + 3 env + 1 SDK refresh |
| SDK SSR asli | PASS dengan Auth HTTP lokal sintetis: token expired memicu satu refresh, user diverifikasi, token/cookie baru diteruskan, Cache-Control/Expires/Pragma dipertahankan. Bukan Supabase hosted/login browser. |
| Cookie/matcher | PASS memakai NextRequest/NextResponse asli dan SDK fixture: multi-batch chunk, stale-cookie deletion, secure options, anon, invalid-session cleanup, aset dan API. |
| Env | PASS dengan fixture: /rest/v1, URL bercredential, secret/service_role publik, placeholder, env kosong dan deklarasi production untuk QA ditolak. Bentuk valid bukan bukti key aktif/environment terisolasi. |
| Lint/build | PASS; build mendeteksi Proxy. Tidak mengubah dependency atau konfigurasi build. |
| HTTP production | PASS pada env lokal sintetis: /login/logo/background 200, empat page privat mengarahkan anon ke /login, avatar API anon 401, foreign origin 403. Tanpa credentials atau data writes. |

Halaman streaming Next dapat memberi HTTP 200 dengan meta redirect `/login` dan digest NEXT_REDIRECT, bukan selalu header 307. Pemeriksaan HTTP membaca redirect yang benar; tidak mengubah aplikasi demi memaksakan status 307.

Test sempat gagal karena dokumentasi lokal menyebut helper experimental doesProxyMatch sedangkan package terpasang mengekspor doesMiddlewareMatch. Test memakai export package aktual; seluruh pemeriksaan akhir PASS. Percobaan HTTP awal juga disesuaikan dengan perilaku streaming terdokumentasi di atas.

## Yang masih harus diuji untuk rilis

Login browser dua STUDENT dan satu ADMIN, refresh token pada project uji sebenarnya, cookie saat navigation/reload, logout/suspended, upload form/approval/realtime, konfigurasi Auth redirect/domain, backup dan pemulihan. Tidak mengganti password/email, menjalankan seed, mengubah schema/RLS atau deploy produksi pada sesi ini.

Owner dapat menjalankan `npm run qa:environment`. Untuk memeriksa deklarasi QA juga: `npm run qa:environment -- --testing`, setelah mengisi NEXUS_QA_ENVIRONMENT dengan development/testing/staging sesuai lingkungan sebenarnya. Variabel tersebut tidak membuktikan pemisahan dari produksi.

Referensi yang diperiksa: [Supabase SSR clients](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [Next Proxy](https://nextjs.org/docs/app/api-reference/file-conventions/proxy), dokumentasi dan types package Next 16.3.8 serta SSR 0.12.5 terpasang. Changelog Supabase diperiksa; tidak mengganti SDK atau memakai contoh schema/RLS tutorial untuk aplikasi ini.
