<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# NEXUS Project Instructions

## Acuan utama
- Baca docs/reference/NEXUS_PRD_UNIFIED.md
  sebelum mengerjakan fitur NEXUS.
- Gunakan PRD sebagai acuan kebutuhan dan aturan produk.
- Dokumen lama digunakan sebagai referensi historis.
- Untuk fakta implementasi, periksa code, migration, dan
  bukti schema aktual yang relevan.
- Jika ada perbedaan dengan PRD, jelaskan terlebih dahulu.
  Jangan diam-diam mengganti aturan produk.

## Cara bekerja
- Lanjutkan proyek existing; jangan membuat ulang proyek.
- Kerjakan hanya scope yang diminta pengguna.
- Ikuti struktur dan pola code yang sudah digunakan.
- Status PLANNED bukan berarti sudah diimplementasikan.
- Untuk NEEDS DECISION, tanyakan keputusan yang diperlukan.
  Lanjutkan bagian lain yang tidak bergantung padanya.

## Database dan keamanan
- Jangan mengubah schema atau RLS di luar scope tugas.
- Jangan mengedit migration yang sudah diterapkan.
  Gunakan migration baru jika perubahan diperlukan.
- Jangan menaruh service role atau secret di frontend.
- Keberadaan tabel atau function bukan bukti runtime PASS.

## Laporan hasil
- Jelaskan perubahan dan file yang diubah.
- Pisahkan hasil pemeriksaan code dari pengujian runtime.
- Nyatakan pengujian yang belum dijalankan.