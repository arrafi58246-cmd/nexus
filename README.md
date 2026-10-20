# NEXUS

Platform Mission dan Squad untuk mahasiswa UNESA, dengan profil, hasil kompetisi, notifikasi, dan alur review admin. Aplikasi memakai Next.js App Router, TypeScript, dan Supabase.

## Menjalankan lokal

```powershell
git clone https://github.com/ReiKatsu/Nexus.git
cd Nexus
npm ci
```

Buat `.env.local` di root proyek dengan dua variabel berikut. Minta URL dan **publishable key** proyek kepada pemilik repo; jangan memasukkan service role key.

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=PROJECT_PUBLISHABLE_KEY
```

Jalankan `npm run dev` lalu buka [http://localhost:3000](http://localhost:3000). `.env.local` tidak masuk Git. Jalankan `npm run lint` dan `npm run build` sebelum mengajukan PR.

Periksa bentuk konfigurasi tanpa menampilkan key dengan `npm run qa:environment`. Gunakan `.env.example` sebagai acuan placeholder; environment aktual diisi owner. Pemeriksaan ini tidak memverifikasi koneksi, akun atau pemisahan dari produksi.

Untuk persiapan QA, isi `NEXUS_QA_ENVIRONMENT=development`, `testing`, atau `staging` sesuai lingkungan sebenarnya lalu jalankan `npm run qa:environment -- --testing`. Status session/deploy dan batas bukti tersedia dalam [rencana rilis](docs/RELEASE_PLAN_2026-10-18.md).

## Petunjuk proyek

- [Aturan kontribusi dan pembagian frontend/backend](CONTRIBUTING.md)
- [Acuan kebutuhan produk](docs/reference/NEXUS_PRD_UNIFIED.md)
- [Panduan agent dan batas perubahan](AGENTS.md)

Kode halaman dan server actions berada di `src/app/`; komponen bersama di `src/components/`; migration dan pemeriksaan database di `supabase/`.
