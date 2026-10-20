import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { readUpload } from "@/lib/uploads/read-upload";
import { MAX_FILE_BYTES, RESULT_BUCKET, validateEvidence } from "@/app/squads/[squadId]/result/file-validation";
import { RESULT_OPTIONS } from "@/app/squads/[squadId]/result/types";

export const runtime = "nodejs";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_REQUEST_BYTES = 11_000_000;

function fail(message: string, status = 400) {
  return Response.json({ success: false, message }, { status });
}

type Context = { params: Promise<{ squadId: string }> };

export async function POST(request: Request, { params }: Context) {
  const { squadId } = await params;
  if (!UUID_PATTERN.test(squadId)) return fail("Squad tidak valid.");

  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin) {
    try {
      if (!host || new URL(origin).host !== host) {
        return fail("Permintaan tidak diizinkan.", 403);
      }
    } catch {
      return fail("Permintaan tidak diizinkan.", 403);
    }
  }
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data")) {
    return fail("Format pengiriman tidak valid.");
  }
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return fail("Total ukuran berkas terlalu besar.", 413);
  }

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return fail("Silakan login kembali.", 401);
  const userId = authData.user.id;

  const [profileQuery, squadQuery, memberQuery, existingQuery] = await Promise.all([
    supabase.from("profiles").select("status_akun, role_app, primary_class_id")
      .eq("user_id", userId).maybeSingle(),
    supabase.from("squads").select("mission_id, ketua_id, status_squad")
      .eq("squad_id", squadId).maybeSingle(),
    supabase.from("squad_members").select("role_squad")
      .eq("squad_id", squadId).eq("user_id", userId)
      .eq("status_member", "ACTIVE").maybeSingle(),
    supabase.from("mission_result_submissions")
      .select("result_submission_id, submitted_by, status_validation, sertifikat_path, dokumen_pendukung_path")
      .eq("squad_id", squadId).maybeSingle(),
  ]);

  if (profileQuery.error || squadQuery.error || memberQuery.error || existingQuery.error) {
    return fail("Data Squad belum dapat diperiksa. Coba lagi.", 503);
  }
  const profile = profileQuery.data;
  const squad = squadQuery.data;
  if (!profile || profile.status_akun !== "ACTIVE" ||
      profile.role_app !== "STUDENT" || profile.primary_class_id === null ||
      !squad || squad.ketua_id !== userId || squad.status_squad !== "FINALIZED" ||
      memberQuery.data?.role_squad !== "KETUA") {
    return fail("Kamu tidak dapat mengirim hasil Squad ini.", 403);
  }
  const existing = existingQuery.data;
  if (existing && (existing.submitted_by !== userId ||
      existing.status_validation !== "REJECTED")) {
    return fail("Hasil sudah dikirim atau tidak dapat dikirim ulang.", 409);
  }

  let fields: FormData;
  try {
    fields = await request.formData();
  } catch {
    return fail("Berkas tidak dapat dibaca.");
  }
  const singular = ["hasil_kompetisi", "submitted_tier_id", "sertifikat", "dokumen_pendukung"];
  if (singular.some((name) => fields.getAll(name).length > 1)) {
    return fail("Isian hasil tidak valid.");
  }

  const result = fields.get("hasil_kompetisi");
  const tierInput = fields.get("submitted_tier_id");
  const storage = supabase.storage.from(RESULT_BUCKET);
  const prefix = `${userId}/${squadId}/`;
  const [certificateUpload, supportingUpload] = await Promise.all([
    readUpload(fields.get("sertifikat"), storage, prefix, MAX_FILE_BYTES),
    readUpload(fields.get("dokumen_pendukung"), storage, prefix, MAX_FILE_BYTES),
  ]);
  const certificate = certificateUpload?.file;
  const optionalInput = fields.get("dokumen_pendukung");
  const optional = supportingUpload?.file ?? null;
  if (typeof result !== "string" ||
      !RESULT_OPTIONS.some((option) => option.value === result) ||
      typeof tierInput !== "string" || !/^[1-9][0-9]*$/.test(tierInput) ||
      !Number.isSafeInteger(Number(tierInput)) ||
      !(certificate instanceof File) ||
      (optionalInput !== null && !(optionalInput instanceof File && !optionalInput.size) && !optional)) {
    return fail("Pencapaian, tier, atau sertifikat tidak valid.");
  }
  const tierId = Number(tierInput);
  const supporting = optional instanceof File && optional.size > 0 ? optional : null;
  const [certificateKind, supportingKind, ruleQuery] = await Promise.all([
    validateEvidence(certificate),
    supporting ? validateEvidence(supporting) : Promise.resolve(null),
    supabase.from("xp_rules").select("verified_xp")
      .eq("tier_id", tierId).eq("hasil_kompetisi", result).maybeSingle(),
  ]);
  if (!certificateKind || (supporting && !supportingKind)) {
    return fail("File harus PDF/JPG/PNG asli dan maksimal 5 MB per file.");
  }
  if (ruleQuery.error || !ruleQuery.data) {
    return fail("Aturan XP untuk tier dan hasil tersebut tidak tersedia.");
  }

  const oldPaths = [existing?.sertifikat_path, existing?.dokumen_pendukung_path];
  if ([certificateUpload?.path, supportingUpload?.path].some((path) => path && oldPaths.includes(path))) {
    return fail("Gunakan berkas baru untuk pengajuan ulang.", 409);
  }
  const newPaths: string[] = [];
  async function upload(file: File, kind: NonNullable<typeof certificateKind>, label: string, direct?: string | null) {
    if (direct) { newPaths.push(direct); return direct; }
    const path = `${userId}/${squadId}/${randomUUID()}-${label}.${kind.extension}`;
    const { error } = await storage.upload(path, file, {
      contentType: kind.contentType,
      upsert: false,
    });
    if (error) return null;
    newPaths.push(path);
    return path;
  }
  async function cleanup() {
    if (newPaths.length) await storage.remove(newPaths);
  }

  const certificatePath = await upload(certificate, certificateKind, "certificate", certificateUpload?.path);
  if (!certificatePath) return fail("Sertifikat belum berhasil diunggah. Coba lagi.", 503);
  const supportingPath = supporting && supportingKind
    ? await upload(supporting, supportingKind, "supporting", supportingUpload?.path)
    : null;
  if (supporting && !supportingPath) {
    await cleanup();
    return fail("Dokumen pendukung belum berhasil diunggah. Coba lagi.", 503);
  }

  const submitted = existing
    ? await supabase.from("mission_result_submissions")
        .update({
          hasil_kompetisi: result,
          submitted_tier_id: tierId,
          sertifikat_path: certificatePath,
          dokumen_pendukung_path: supportingPath,
          preview_xp: ruleQuery.data.verified_xp,
          status_validation: "PENDING",
        })
        .eq("result_submission_id", existing.result_submission_id)
        .eq("status_validation", "REJECTED")
        .select("result_submission_id").maybeSingle()
    : await supabase.from("mission_result_submissions")
        .insert({
          squad_id: squadId,
          submitted_by: userId,
          hasil_kompetisi: result,
          submitted_tier_id: tierId,
          sertifikat_path: certificatePath,
          dokumen_pendukung_path: supportingPath,
          preview_xp: ruleQuery.data.verified_xp,
          status_validation: "PENDING",
        })
        .select("result_submission_id").maybeSingle();

  if (submitted.error || !submitted.data) {
    await cleanup();
    return fail("Hasil belum tersimpan. Muat ulang lalu coba lagi.", 409);
  }

  if (existing) {
    const oldPaths = [existing.sertifikat_path, existing.dokumen_pendukung_path]
      .filter((path): path is string =>
        typeof path === "string" && path.startsWith(`${userId}/${squadId}/`));
    // The new result is already saved, so an old-file cleanup error must not
    // make this successful submission appear to have failed.
    if (oldPaths.length) {
      try {
        await storage.remove(oldPaths);
      } catch {
        // Retain the saved result; a failed deletion can be retried separately.
      }
    }
  }

  revalidatePath(`/squads/${squadId}`);
  revalidatePath(`/squads/${squadId}/result`);
  revalidatePath("/my-squad");
  return Response.json({ success: true });
}
