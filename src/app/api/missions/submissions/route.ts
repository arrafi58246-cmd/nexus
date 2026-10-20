import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import { MAX_DOCUMENT_BYTES, validSubmissionId, validateDocument, validateFields,
  type MissionFieldErrors } from
  "@/app/missions/add/validation";
import { createClient } from "@/lib/supabase/server";
import { readUpload } from "@/lib/uploads/read-upload";

export const runtime = "nodejs";

const BUCKET = "mission-documents";
const MAX_BANNER_BYTES = 2_097_152;

function fail(message: string, status = 400, fieldErrors?: MissionFieldErrors) {
  return Response.json({ success: false, message, fieldErrors }, { status });
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  try {
    if (origin && (!host || new URL(origin).host !== host)) {
      return fail("Permintaan tidak diizinkan.", 403);
    }
  } catch { return fail("Permintaan tidak diizinkan.", 403); }
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data")) {
    return fail("Format pengiriman tidak valid.");
  }
  const length = Number(request.headers.get("content-length"));
  if (Number.isFinite(length) && length > 11_500_000) {
    return fail("Periksa kolom yang ditandai.", 413, {
      dokumen: "Berkas terlalu besar. Maksimal 10 MiB.",
    });
  }

  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) return fail("Silakan login kembali.", 401);
  const userId = auth.user.id;
  const { data: profile, error: profileError } = await supabase.from("profiles")
    .select("role_app,status_akun,primary_class_id")
    .eq("user_id", userId).maybeSingle();
  if (profileError || profile?.role_app !== "STUDENT" ||
      profile.status_akun !== "ACTIVE" || profile.primary_class_id === null) {
    return fail("Akun mahasiswa belum dapat mengajukan Mission.", 403);
  }

  let form: FormData;
  try { form = await request.formData(); } catch { return fail("Isian tidak dapat dibaca."); }
  const { fields, errors } = validateFields(form);
  const uploadId = form.get("upload_id");
  const oldId = form.get("submission_id");
  if (form.getAll("submission_id").length > 1 ||
      (oldId !== null && (typeof oldId !== "string" || !validSubmissionId(oldId)))) {
    return fail("Pengajuan tidak valid. Muat ulang halaman.", 400);
  }
  if (form.getAll("upload_id").length > 1 || (uploadId !== null &&
      (typeof uploadId !== "string" || !validSubmissionId(uploadId) ||
       (oldId !== null && oldId !== uploadId)))) return fail("Berkas tidak valid.");
  const submissionId = String(oldId ?? uploadId ?? randomUUID());
  const storage = supabase.storage.from(BUCKET);
  const uploaded = await readUpload(form.get("dokumen"), storage,
    `${userId}/${submissionId}/`, MAX_DOCUMENT_BYTES);
  const file = uploaded?.file;
  const fileIsPresent = file instanceof File;
  if (!fileIsPresent) errors.dokumen = "Pilih poster atau dokumen lomba.";
  if (!fields || !fileIsPresent) {
    return fail("Periksa kolom yang ditandai.", 400, errors);
  }
  const kind = await validateDocument(file);
  if (!kind) return fail("Periksa kolom yang ditandai.", 400, {
    dokumen: "Berkas harus PDF/JPG/PNG asli, maksimal 10 MiB.",
  });

  // Banner opsional: hasil crop JPG dari browser. Tanpa banner, halaman Mission memakai poster.
  const bannerErrorMessage = "Banner harus berupa gambar JPG hasil crop, maksimal 2 MiB. Atur ulang banner.";
  const bannerValue = form.get("banner");
  if (form.getAll("banner").length > 1) {
    return fail("Periksa kolom yang ditandai.", 400, { banner: "Isian ganda tidak diizinkan." });
  }
  const bannerSent = bannerValue !== null && bannerValue !== "";
  const bannerUpload = bannerSent
    ? await readUpload(bannerValue, storage, `${userId}/${submissionId}/`, MAX_BANNER_BYTES)
    : null;
  if (bannerSent) {
    const bannerKind = bannerUpload ? await validateDocument(bannerUpload.file) : null;
    if (!bannerUpload || !bannerKind || bannerKind.extension !== "jpg" ||
        bannerUpload.file.size > MAX_BANNER_BYTES) {
      return fail("Periksa kolom yang ditandai.", 400, { banner: bannerErrorMessage });
    }
  }

  const oldQuery = oldId
    ? await supabase.from("mission_submissions")
        .select("mission_submission_id,submitted_by,status_review,dokumen_path,banner_path")
        .eq("mission_submission_id", oldId).maybeSingle()
    : { data: null, error: null };
  if (oldQuery.error) return fail("Pengajuan belum dapat diperiksa.", 503);
  const old = oldQuery.data;
  if (oldId && (!old || old.submitted_by !== userId || old.status_review !== "REJECTED")) {
    return fail("Hanya pengajuan yang ditolak dapat dikirim ulang.", 409);
  }

  if (uploaded?.path && uploaded.path === old?.dokumen_path) {
    return fail("Gunakan berkas baru untuk pengajuan ulang.", 409);
  }
  const path = uploaded?.path ?? `${userId}/${submissionId}/${randomUUID()}.${kind.extension}`;
  const { error: uploadError } = uploaded?.path ? { error: null }
    : await storage.upload(path, file, { contentType: kind.contentType, upsert: false });
  if (uploadError) return fail("Berkas belum berhasil diunggah. Coba lagi.", 503, {
    dokumen: "Berkas belum berhasil diunggah. Coba lagi.",
  });

  if (bannerUpload?.path && bannerUpload.path === old?.banner_path) {
    return fail("Gunakan banner baru untuk pengajuan ulang.", 409, {
      banner: "Atur ulang banner untuk pengajuan ulang.",
    });
  }
  const bannerPath = bannerUpload
    ? bannerUpload.path ?? `${userId}/${submissionId}/${randomUUID()}-banner.jpg`
    : null;
  if (bannerUpload && bannerPath && !bannerUpload.path) {
    const { error: bannerUploadError } = await storage.upload(bannerPath, bannerUpload.file,
      { contentType: "image/jpeg", upsert: false });
    if (bannerUploadError) {
      if (!uploaded?.path) await storage.remove([path]);
      return fail("Banner belum berhasil diunggah. Coba lagi.", 503, {
        banner: "Banner belum berhasil diunggah. Coba lagi.",
      });
    }
  }

  const saved = old
    ? await supabase.from("mission_submissions")
        .update({ ...fields, dokumen_path: path, banner_path: bannerPath,
          status_review: "PENDING" })
        .eq("mission_submission_id", submissionId).eq("submitted_by", userId)
        .eq("status_review", "REJECTED")
        .select("mission_submission_id").maybeSingle()
    : await supabase.from("mission_submissions")
        .insert({ ...fields, dokumen_path: path, banner_path: bannerPath,
          mission_submission_id: submissionId, submitted_by: userId })
        .select("mission_submission_id").maybeSingle();
  if (saved.error || !saved.data) {
    await storage.remove(bannerPath ? [path, bannerPath] : [path]);
    if (saved.error?.code === "23505") {
      return fail("Pengajuan serupa sudah ada.", 409, {
        nama_lomba: "Nama lomba, penyelenggara, dan tahun ini sudah diajukan.",
      });
    }
    if (saved.error?.message?.includes("Registration deadline has passed")) {
      return fail("Periksa kolom yang ditandai.", 409, {
        deadline_pendaftaran: "Deadline pendaftaran sudah lewat.",
      });
    }
    if (saved.error?.message?.includes("Team competition requires valid minimum and maximum participants")) {
      return fail("Periksa kolom yang ditandai.", 409, {
        min_anggota_tim: "Rentang peserta tim belum valid.",
        max_anggota_tim: "Periksa rentang peserta resmi lomba.",
      });
    }
    if (saved.error?.message?.includes("Mission banner is missing or invalid") ||
        saved.error?.message?.includes("Banner path does not belong")) {
      return fail("Periksa kolom yang ditandai.", 409, { banner: bannerErrorMessage });
    }
    if (saved.error?.message?.includes("Mission document is missing or invalid")) {
      return fail("Periksa kolom yang ditandai.", 409, {
        dokumen: "Dokumen belum tersedia atau tidak valid. Unggah ulang.",
      });
    }
    return fail("Pengajuan belum tersimpan. Muat ulang lalu coba lagi.", 409);
  }

  const stale = [old?.dokumen_path, old?.banner_path].filter((value): value is string =>
    Boolean(value) && value!.startsWith(`${userId}/${submissionId}/`) &&
    value !== path && value !== bannerPath);
  if (stale.length) {
    try { await storage.remove(stale); } catch { /* Already saved. */ }
  }
  revalidatePath("/missions/submissions");
  revalidatePath("/admin/missions");
  return Response.json({ success: true, submissionId });
}
