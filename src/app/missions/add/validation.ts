import { CATEGORIES, COSTS, MODES, ORGANIZERS, SCOPES } from "./options";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MAX_DOCUMENT_BYTES = 10_485_760;
const FIELD_NAMES = ["nama_lomba", "penyelenggara", "kategori_penyelenggara",
  "link_resmi", "deadline_pendaftaran", "deadline_lomba", "tahun_lomba",
  "kategori_lomba", "cakupan_peserta", "mode_lomba", "biaya_pendaftaran",
  "min_anggota_tim", "max_anggota_tim", "deskripsi_singkat", "dokumen", "banner"] as const;
export type MissionField = typeof FIELD_NAMES[number];
export type MissionFieldErrors = Partial<Record<MissionField, string>>;

export function validSubmissionId(value: string): boolean { return UUID.test(value); }

export async function validateDocument(file: File) {
  if (!file.size || file.size > MAX_DOCUMENT_BYTES) return null;
  const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  if (file.type === "application/pdf" && bytes[0] === 0x25 && bytes[1] === 0x50 &&
      bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d) {
    return { extension: "pdf", contentType: file.type };
  }
  if (file.type === "image/png" &&
      [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
        .every((byte, index) => bytes[index] === byte)) {
    return { extension: "png", contentType: file.type };
  }
  if (file.type === "image/jpeg" && bytes[0] === 0xff &&
      bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { extension: "jpg", contentType: file.type };
  }
  return null;
}

function choice(value: FormDataEntryValue | null, options: readonly (readonly [string, string])[]) {
  return typeof value === "string" && options.some(([key]) => key === value)
    ? value : null;
}

function text(value: FormDataEntryValue | null, max: number) {
  return typeof value === "string" && value.trim() && value.trim().length <= max
    ? value.trim() : null;
}

function deadline(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === value ? value : null;
}

export function validateFields(form: FormData) {
  const errors: MissionFieldErrors = {};
  for (const name of FIELD_NAMES) {
    if (form.getAll(name).length > 1) errors[name] = "Isian ganda tidak diizinkan.";
  }
  const name = text(form.get("nama_lomba"), 200);
  const organizer = text(form.get("penyelenggara"), 200);
  const link = text(form.get("link_resmi"), 2048);
  const description = text(form.get("deskripsi_singkat"), 3000);
  const registration = deadline(form.get("deadline_pendaftaran"));
  const competition = deadline(form.get("deadline_lomba"));
  const rawYear = form.get("tahun_lomba");
  const year = typeof rawYear === "string" && /^[0-9]{4}$/.test(rawYear)
    ? Number(rawYear) : NaN;
  const minRaw = form.get("min_anggota_tim");
  const maxRaw = form.get("max_anggota_tim");
  const min = Number(minRaw);
  const max = Number(maxRaw);

  if (!name) errors.nama_lomba = "Isi nama lomba (maksimal 200 karakter).";
  if (!organizer) errors.penyelenggara = "Isi penyelenggara (maksimal 200 karakter).";
  if (!description) errors.deskripsi_singkat = "Isi deskripsi (maksimal 3000 karakter).";
  try {
    if (!link || !["https:", "http:"].includes(new URL(link).protocol)) {
      errors.link_resmi = "Isi tautan resmi dengan http:// atau https://.";
    }
  } catch { errors.link_resmi = "Isi tautan resmi dengan http:// atau https://."; }
  if (!registration) {
    errors.deadline_pendaftaran = "Isi deadline pendaftaran yang valid.";
  } else if (registration <= new Date().toISOString()) {
    errors.deadline_pendaftaran = "Deadline pendaftaran harus di masa mendatang.";
  }
  if (!competition) {
    errors.deadline_lomba = "Isi deadline lomba yang valid.";
  } else if (registration && competition < registration) {
    errors.deadline_lomba = "Deadline lomba tidak boleh sebelum deadline pendaftaran.";
  }
  if (!Number.isSafeInteger(year) || year < 1000 || year > 9999) {
    errors.tahun_lomba = "Isi tahun lomba empat digit, misalnya 2026.";
  }
  if (typeof minRaw !== "string" || !minRaw.trim() ||
      !Number.isInteger(min) || min < 2 || min > 32767) {
    errors.min_anggota_tim = "Minimum peserta tim harus 2 sampai 32767, termasuk Ketua.";
  }
  if (typeof maxRaw !== "string" || !maxRaw.trim() ||
      !Number.isInteger(max) || max < 2 || max > 32767) {
    errors.max_anggota_tim = "Maksimum peserta tim harus 2 sampai 32767, termasuk Ketua.";
  } else if (!errors.min_anggota_tim && max < min) {
    errors.max_anggota_tim = "Maksimum peserta tidak boleh lebih kecil dari minimum.";
  }

  const kategori_penyelenggara = choice(form.get("kategori_penyelenggara"), ORGANIZERS);
  const kategori_lomba = choice(form.get("kategori_lomba"), CATEGORIES);
  const cakupan_peserta = choice(form.get("cakupan_peserta"), SCOPES);
  const mode_lomba = choice(form.get("mode_lomba"), MODES);
  const biaya_pendaftaran = choice(form.get("biaya_pendaftaran"), COSTS);
  if (!kategori_penyelenggara) errors.kategori_penyelenggara = "Pilih kategori penyelenggara.";
  if (!kategori_lomba) errors.kategori_lomba = "Pilih kategori lomba.";
  if (!cakupan_peserta) errors.cakupan_peserta = "Pilih cakupan peserta.";
  if (!mode_lomba) errors.mode_lomba = "Pilih mode lomba.";
  if (!biaya_pendaftaran) errors.biaya_pendaftaran = "Pilih biaya pendaftaran.";
  if (Object.keys(errors).length || !name || !organizer || !description || !link ||
      !registration || !competition || !kategori_penyelenggara || !kategori_lomba ||
      !cakupan_peserta || !mode_lomba || !biaya_pendaftaran) {
    return { fields: null, errors };
  }
  return { fields: { nama_lomba: name, penyelenggara: organizer,
    kategori_penyelenggara, link_resmi: link,
    deadline_pendaftaran: registration, deadline_lomba: competition,
    tahun_lomba: year, kategori_lomba, cakupan_peserta, mode_lomba,
    biaya_pendaftaran, min_anggota_tim: min, max_anggota_tim: max,
    deskripsi_singkat: description }, errors };
}
