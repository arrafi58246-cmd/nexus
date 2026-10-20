import type { PasswordRequirement, SafeAuthError } from "./registerTypes";

export const PASSWORD_MISMATCH_MESSAGE = "Konfirmasi password tidak sama.";
export const STUDENT_EMAIL_ERROR_MESSAGE =
  "Gunakan email mahasiswa UNESA (@mhs.unesa.ac.id).";
export const STUDENT_EMAIL_PATTERN = /^[^@\s]+@mhs\.unesa\.ac\.id$/;

export function getPasswordRequirements(
  password: string,
): PasswordRequirement[] {
  return [
    { label: "Minimal 8 karakter", isMet: password.length >= 8 },
    { label: "Mengandung huruf besar", isMet: /[A-Z]/.test(password) },
    { label: "Mengandung huruf kecil", isMet: /[a-z]/.test(password) },
    { label: "Mengandung angka", isMet: /[0-9]/.test(password) },
    {
      label: "Mengandung karakter khusus",
      isMet: /[\x21-\x2F\x3A-\x40\x5B-\x60\x7B-\x7E]/.test(password),
    },
  ];
}

export function getSafeSignUpErrorMessage(error: SafeAuthError) {
  if (
    error.status === 429 ||
    error.code === "over_request_rate_limit" ||
    error.code === "over_email_send_rate_limit"
  ) {
    return "Terlalu banyak percobaan pendaftaran. Tunggu beberapa saat lalu coba lagi.";
  }

  switch (error.code) {
    case "email_address_invalid":
      return "Alamat email tidak valid. Periksa kembali email Anda.";
    case "email_address_not_authorized":
      return "Alamat email tersebut belum diizinkan untuk melakukan pendaftaran.";
    case "email_exists":
    case "user_already_exists":
      return "Pendaftaran dengan email tersebut tidak dapat diproses. Silakan gunakan email lain atau coba masuk.";
    case "weak_password":
      return "Password ditolak oleh server. Pastikan password memenuhi seluruh persyaratan NEXUS.";
    case "signup_disabled":
    case "email_provider_disabled":
    case "provider_disabled":
      return "Pendaftaran akun sedang tidak tersedia. Silakan coba lagi nanti.";
    case "captcha_failed":
      return "Verifikasi keamanan gagal. Silakan muat ulang halaman dan coba lagi.";
    default:
      return "Pendaftaran belum berhasil. Silakan coba lagi.";
  }
}
