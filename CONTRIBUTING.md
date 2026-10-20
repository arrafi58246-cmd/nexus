# Berkontribusi pada NEXUS

NEXUS adalah satu aplikasi Next.js dengan Supabase. Frontend dan backend bekerja di repo yang sama. Baca `AGENTS.md` dan `docs/reference/NEXUS_PRD_UNIFIED.md` sebelum mengubah perilaku produk; dokumentasi lama adalah referensi historis.

## Area kerja

| Area | Lokasi utama | Perhatikan |
| --- | --- | --- |
| Frontend | `src/components/`, komponen client dan tampilan di `src/app/`, `src/app/globals.css` | Jangan menebak data atau status yang belum tersedia. |
| Backend | `src/app/api/`, server actions di `src/app/`, `src/lib/supabase/server.ts`, `supabase/migrations/`, `supabase/tests/` | Periksa autentikasi, RLS, kontrak database, dan error aman. |
| Bersama | `page.tsx` yang memuat data, `types.ts`, `src/lib/`, PRD | Koordinasikan perubahan pada file yang sama sebelum mulai. |

Nama folder tidak otomatis menentukan pemiliknya: `page.tsx` bisa memuat UI sekaligus query server. Bila satu fitur mengubah dua area, gunakan satu PR fitur dan tulis dampaknya di deskripsi PR.

## Alur kerja

1. Mulai dari `main` terbaru. Buat satu branch untuk satu pekerjaan, misalnya `feat/ui-profile-card` atau `feat/api-squad-members`.
2. Ubah hanya berkas terkait; jangan mengedit migration yang sudah diterapkan. Untuk perubahan schema, buat migration baru dan jelaskan cara verifikasinya.
3. Jalankan `npm run lint` dan `npm run build`. Uji alur di browser untuk perubahan UI dan hak akses untuk perubahan backend; hasil build saja bukan bukti perilaku runtime.
4. Push branch lalu buat Pull Request (PR) ke `main`. Isi template PR, sertakan tangkapan layar untuk tampilan yang berubah, dan minta review pada area yang terdampak.
5. Setelah review, pemeriksaan otomatis, dan uji yang relevan selesai, merge PR. Branch yang PR-nya sudah merged dapat dihapus; riwayat perubahan tetap ada di PR.

Jangan push langsung ke `main`. Kebijakan ini adalah kesepakatan tim; enforcement di GitHub perlu diaktifkan terpisah bila paket repo mendukungnya.

## Menjalankan proyek (PowerShell)

```powershell
git clone https://github.com/ReiKatsu/Nexus.git
cd Nexus
npm ci
```

Buat `.env.local` di root proyek berisi `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` dari pemilik proyek, lalu jalankan `npm run dev`. Jangan commit `.env.local`, service role key, kata sandi, atau data uji pribadi. PR frontend yang memerlukan data baru sebaiknya menyepakati kontrak data dengan backend sebelum implementasi.

Untuk pekerjaan berikutnya pada salinan repo yang sudah ada:

```powershell
git switch main
git pull --ff-only
git switch -c feat/nama-pekerjaan
```

Jika `git status --short` menunjukkan perubahan lokal, simpan atau koordinasikan perubahan itu sebelum berpindah branch.
