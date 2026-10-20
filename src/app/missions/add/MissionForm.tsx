"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from "react";

import { submitWithUploads } from "@/lib/uploads/submit-with-uploads";

import BannerCropper, { type BannerState } from "./BannerCropper";
import { CATEGORIES, COSTS, MODES, ORGANIZERS, SCOPES,
  type MissionSubmission } from "./options";
import { MAX_DOCUMENT_BYTES, validateDocument, validateFields,
  type MissionField, type MissionFieldErrors } from "./validation";

function fieldAttributes(name: MissionField, errors: MissionFieldErrors) {
  return {
    "aria-invalid": Boolean(errors[name]) || undefined,
    "aria-describedby": errors[name] ? `${name}-error` : undefined,
  };
}

function FieldError({ name, errors }: { name: MissionField; errors: MissionFieldErrors }) {
  return errors[name] ? <span id={`${name}-error`}
    className="mt-1 block text-xs font-normal text-red-700">{errors[name]}</span> : null;
}

function isoFromWib(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(`${value}:00+07:00`);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function localDate(iso: string | undefined) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(new Date(iso)).replace(" ", "T");
}

function Choice({ name, label, options, initial, errors }: {
  name: MissionField; label: string; options: readonly (readonly [string, string])[];
  initial?: string; errors: MissionFieldErrors;
}) {
  return <label className="block text-sm font-semibold">{label}
    <select name={name} required defaultValue={initial ?? ""}
      {...fieldAttributes(name, errors)}
      className="mt-1 block w-full rounded-lg border border-slate-300 p-2">
      <option value="" disabled>Pilih {label.toLowerCase()}</option>
      {options.map(([value, display]) => <option key={value} value={value}>{display}</option>)}
    </select>
    <FieldError name={name} errors={errors} />
  </label>;
}

export default function MissionForm({ initial }: { initial: MissionSubmission | null }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<MissionFieldErrors>({});
  const [suggestions, setSuggestions] = useState<{
    nama_lomba: string; penyelenggara: string; tahun_lomba: number;
  }[]>([]);
  const [posterPreview, setPosterPreview] = useState<string | null>(null);
  const [banner, setBanner] = useState<BannerState>({ active: false, file: null });

  // Hasil crop banner datang dari BannerCropper; menyentuh banner menghapus pesan galatnya.
  const changeBanner = useCallback((next: BannerState) => {
    setBanner((current) => current.active === next.active && current.file === next.file ? current : next);
    setFieldErrors((current) => current.banner ? { ...current, banner: undefined } : current);
  }, []);

  // Pratinjau poster hanya ada di browser; URL sementara dilepas saat berganti/keluar halaman.
  useEffect(() => () => { if (posterPreview) URL.revokeObjectURL(posterPreview); }, [posterPreview]);

  function choosePoster(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    setPosterPreview(file && file.type.startsWith("image/") ? URL.createObjectURL(file) : null);
  }

  async function checkSimilar(name: string) {
    if (name.trim().length < 3) { setSuggestions([]); return; }
    try {
      const response = await fetch(`/api/missions/suggestions?name=${encodeURIComponent(name.trim())}`);
      if (!response.ok) return;
      const result: { matches: typeof suggestions } = await response.json();
      setSuggestions(result.matches);
    } catch { /* The database still rejects exact duplicates on submit. */ }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const element = event.currentTarget;
    const form = new FormData(element);
    const registration = isoFromWib(String(form.get("deadline_pendaftaran") ?? ""));
    const competition = isoFromWib(String(form.get("deadline_lomba") ?? ""));
    if (registration) form.set("deadline_pendaftaran", registration);
    if (competition) form.set("deadline_lomba", competition);
    const file = form.get("dokumen");
    const validation = validateFields(form);
    const errors = { ...validation.errors };
    if (!(file instanceof File) || !file.size) {
      errors.dokumen = "Pilih poster lomba.";
    } else if (file.size > MAX_DOCUMENT_BYTES) {
      errors.dokumen = "Poster terlalu besar. Maksimal 10 MiB.";
    } else {
      const kind = await validateDocument(file);
      if (!kind || kind.extension === "pdf") {
        errors.dokumen = "Poster harus berupa gambar JPG atau PNG asli.";
      }
    }
    if (banner.active && !banner.file) {
      errors.banner = "Banner belum siap. Pilih gambar yang valid atau hapus banner.";
    }
    if (Object.keys(errors).length) {
      showFieldErrors(errors, element);
      return;
    }
    if (banner.active && banner.file) form.set("banner", banner.file);
    else form.delete("banner");
    if (!window.confirm("Kirim pengajuan Mission ini untuk diperiksa admin?")) return;
    setPending(true);
    setError("");
    try {
      const response = await submitWithUploads("/api/missions/submissions", form,
        "mission-documents", ["dokumen", "banner"], initial?.mission_submission_id);
      const result: { success?: boolean; message?: string;
        fieldErrors?: MissionFieldErrors } = await response.json();
      if (!response.ok || !result.success) {
        if (result.fieldErrors && Object.keys(result.fieldErrors).length) {
          showFieldErrors(result.fieldErrors, element);
        } else {
          setError(result.message ?? "Pengajuan belum terkirim. Coba lagi.");
        }
        return;
      }
      router.replace("/missions/submissions");
      router.refresh();
    } catch {
      setError("Koneksi bermasalah. Coba lagi setelah memeriksa jaringan.");
    } finally { setPending(false); }
  }

  function showFieldErrors(errors: MissionFieldErrors, element: HTMLFormElement) {
    setFieldErrors(errors);
    setError("Perbaiki kolom yang ditandai.");
    const first = Object.keys(errors)[0];
    const control = element.elements.namedItem(first);
    if (control instanceof HTMLElement) control.focus();
  }

  return <form onSubmit={submit} noValidate aria-busy={pending}
    onChange={(event) => {
      const target = event.nativeEvent.target;
      if (!(target instanceof HTMLInputElement ||
            target instanceof HTMLSelectElement ||
            target instanceof HTMLTextAreaElement)) return;
      const name = target.name as MissionField;
      if (fieldErrors[name]) setFieldErrors((current) => ({ ...current, [name]: undefined }));
      if (error) setError("");
    }}
    className="mt-6 space-y-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
    {initial && <input type="hidden" name="submission_id"
      value={initial.mission_submission_id} />}
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block text-sm font-semibold">Nama lomba
        <input name="nama_lomba" required maxLength={200} defaultValue={initial?.nama_lomba}
          onBlur={(event) => checkSimilar(event.currentTarget.value)}
          {...fieldAttributes("nama_lomba", fieldErrors)}
          className="mt-1 block w-full rounded-lg border border-slate-300 p-2" />
        <FieldError name="nama_lomba" errors={fieldErrors} />
      </label>
      <label className="block text-sm font-semibold">Penyelenggara
        <input name="penyelenggara" required maxLength={200} defaultValue={initial?.penyelenggara}
          {...fieldAttributes("penyelenggara", fieldErrors)}
          className="mt-1 block w-full rounded-lg border border-slate-300 p-2" />
        <FieldError name="penyelenggara" errors={fieldErrors} />
      </label>
      <Choice name="kategori_penyelenggara" label="Kategori penyelenggara"
        options={ORGANIZERS} initial={initial?.kategori_penyelenggara} errors={fieldErrors} />
      <Choice name="kategori_lomba" label="Kategori lomba"
        options={CATEGORIES} initial={initial?.kategori_lomba} errors={fieldErrors} />
      <Choice name="cakupan_peserta" label="Cakupan peserta"
        options={SCOPES} initial={initial?.cakupan_peserta} errors={fieldErrors} />
      <Choice name="mode_lomba" label="Mode lomba"
        options={MODES} initial={initial?.mode_lomba} errors={fieldErrors} />
      <Choice name="biaya_pendaftaran" label="Biaya pendaftaran"
        options={COSTS} initial={initial?.biaya_pendaftaran} errors={fieldErrors} />
      <label className="block text-sm font-semibold">Tahun lomba
        <input name="tahun_lomba" type="text" inputMode="numeric" pattern="[0-9]{4}"
          maxLength={4} required defaultValue={initial?.tahun_lomba ?? new Date().getFullYear()}
          {...fieldAttributes("tahun_lomba", fieldErrors)}
          className="mt-1 block w-full rounded-lg border border-slate-300 p-2" />
        <span className="mt-1 block text-xs font-normal text-slate-600">
          Tahun kompetisi berlangsung, misalnya 2026.
        </span>
        <FieldError name="tahun_lomba" errors={fieldErrors} />
      </label>
      <label className="block text-sm font-semibold">Deadline pendaftaran (WIB)
        <input name="deadline_pendaftaran" type="datetime-local" required
          defaultValue={localDate(initial?.deadline_pendaftaran)}
          {...fieldAttributes("deadline_pendaftaran", fieldErrors)}
          className="mt-1 block w-full rounded-lg border border-slate-300 p-2" />
        <FieldError name="deadline_pendaftaran" errors={fieldErrors} />
      </label>
      <label className="block text-sm font-semibold">Deadline lomba (WIB)
        <input name="deadline_lomba" type="datetime-local" required
          defaultValue={localDate(initial?.deadline_lomba)}
          {...fieldAttributes("deadline_lomba", fieldErrors)}
          className="mt-1 block w-full rounded-lg border border-slate-300 p-2" />
        <FieldError name="deadline_lomba" errors={fieldErrors} />
      </label>
      <label className="block text-sm font-semibold">Minimum peserta tim (termasuk Ketua)
        <input name="min_anggota_tim" type="number" min={2} max={32767} required
          defaultValue={initial?.min_anggota_tim}
          {...fieldAttributes("min_anggota_tim", fieldErrors)}
          className="mt-1 block w-full rounded-lg border border-slate-300 p-2" />
        <FieldError name="min_anggota_tim" errors={fieldErrors} />
      </label>
      <label className="block text-sm font-semibold">Maksimum peserta tim (termasuk Ketua)
        <input name="max_anggota_tim" type="number" min={2} max={32767} required
          defaultValue={initial?.max_anggota_tim}
          {...fieldAttributes("max_anggota_tim", fieldErrors)}
          className="mt-1 block w-full rounded-lg border border-slate-300 p-2" />
        <FieldError name="max_anggota_tim" errors={fieldErrors} />
      </label>
    </div>
    {suggestions.length > 0 && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
      <p className="font-semibold">Periksa kemungkinan pengajuan serupa:</p>
      <ul className="mt-2 list-inside list-disc">
        {suggestions.map((item, index) => <li key={`${item.nama_lomba}:${item.tahun_lomba}:${index}`}>
          {item.nama_lomba} · {item.penyelenggara} ({item.tahun_lomba})
        </li>)}
      </ul>
    </div>}
    <label className="block text-sm font-semibold">Link resmi
      <input name="link_resmi" type="url" required maxLength={2048}
        defaultValue={initial?.link_resmi} placeholder="https://..."
        {...fieldAttributes("link_resmi", fieldErrors)}
        className="mt-1 block w-full rounded-lg border border-slate-300 p-2" />
      <FieldError name="link_resmi" errors={fieldErrors} />
    </label>
    <label className="block text-sm font-semibold">Deskripsi singkat
      <textarea name="deskripsi_singkat" required maxLength={3000} rows={4}
        defaultValue={initial?.deskripsi_singkat}
        {...fieldAttributes("deskripsi_singkat", fieldErrors)}
        className="mt-1 block w-full rounded-lg border border-slate-300 p-2" />
      <FieldError name="deskripsi_singkat" errors={fieldErrors} />
    </label>
    <div className="poster-upload">
      <label className="block text-sm font-semibold">Poster lomba
        <input name="dokumen" type="file" required onChange={choosePoster}
          accept=".jpg,.jpeg,.png,image/jpeg,image/png"
          {...fieldAttributes("dokumen", fieldErrors)}
          className="mt-1 block w-full text-sm" />
        <span className="mt-1 block text-xs font-normal text-slate-600">
          JPG atau PNG, maksimal 10 MiB. Poster ini ditampilkan di kartu Mission setelah disetujui admin.
        </span>
        <FieldError name="dokumen" errors={fieldErrors} />
      </label>
      <div className="poster-upload-preview" aria-live="polite">
        {posterPreview
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={posterPreview} alt="Pratinjau poster yang dipilih" />
          : <span>Pratinjau poster</span>}
      </div>
    </div>
    <BannerCropper posterUrl={posterPreview} error={fieldErrors.banner} onChange={changeBanner} />
    <p className="text-sm text-slate-600">
      Pengajuan yang menunggu review belum muncul di Discovery. Tier akhir ditetapkan admin.
      Periksa Mission yang sudah tersedia agar tidak mengajukan duplikat.</p>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <div className="flex flex-wrap items-center gap-4">
      <button type="submit" disabled={pending}
        className="rounded-lg bg-indigo-600 px-5 py-2 font-semibold text-white disabled:opacity-50">
        {pending ? "Mengirim..." : initial ? "Kirim ulang" : "Ajukan Mission"}
      </button>
      <Link href="/missions/submissions" className="text-sm font-semibold text-slate-600">Batal</Link>
    </div>
  </form>;
}
