"use client";

import { useRouter } from "next/navigation";
import { type ChangeEvent, type FormEvent, useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";

import AcademicFields from "./AcademicFields";
import { PasswordConfirmationField, PasswordField } from "./PasswordField";
import type { RegisterFormProps, SignUpFeedback } from "./registerTypes";
import {
  getPasswordRequirements,
  getSafeSignUpErrorMessage,
  PASSWORD_MISMATCH_MESSAGE,
  STUDENT_EMAIL_ERROR_MESSAGE,
  STUDENT_EMAIL_PATTERN,
} from "./registerValidation";

const inputClassName =
  "h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100";

export default function RegisterForm({ faculties, studyPrograms, facultyLoadFailed, studyProgramLoadFailed }: RegisterFormProps) {
  const [selectedFacultyId, setSelectedFacultyId] = useState("");
  const [selectedStudyProgramId, setSelectedStudyProgramId] = useState("");
  const [email, setEmail] = useState("");
  const [nim, setNim] = useState("");
  const [nimTouched, setNimTouched] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [nativeFormIsValid, setNativeFormIsValid] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [signUpFeedback, setSignUpFeedback] = useState<SignUpFeedback | null>(null);
  const passwordConfirmationInputRef = useRef<HTMLInputElement>(null);
  const signUpInProgressRef = useRef(false);
  const router = useRouter();

  const filteredStudyPrograms = studyPrograms.filter((program) => program.fakultas_id === selectedFacultyId);
  const facultyDataEmpty = faculties.length === 0;
  const studyProgramDataEmpty = studyPrograms.length === 0;
  const facultyUnavailable = facultyLoadFailed || facultyDataEmpty;
  const studyProgramUnavailable = studyProgramLoadFailed || studyProgramDataEmpty;
  const selectedFacultyHasNoStudyPrograms = Boolean(selectedFacultyId) && !studyProgramUnavailable && filteredStudyPrograms.length === 0;
  const studyProgramDisabled = !selectedFacultyId || studyProgramUnavailable || selectedFacultyHasNoStudyPrograms;
  const emailIsStudentAddress = STUDENT_EMAIL_PATTERN.test(email);
  const emailHasDomainError = email.length > 0 && !emailIsStudentAddress;
  const nimIsEmpty = nim.length === 0;
  const nimHasInvalidLength = !nimIsEmpty && nim.length !== 11;
  const nimHasNonDigitCharacters = !nimIsEmpty && !/^[0-9]+$/.test(nim);
  const nimHasVisibleError = (nimTouched && nimIsEmpty) || nimHasInvalidLength || nimHasNonDigitCharacters;
  const passwordRequirements = getPasswordRequirements(password);
  const passwordMeetsPolicy = password.length <= 64 && passwordRequirements.every((requirement) => requirement.isMet);
  const passwordConfirmationMismatch = passwordConfirmation.length > 0 && passwordConfirmation !== password;
  const passwordsMatch = password.length > 0 && passwordConfirmation.length > 0 && passwordConfirmation === password;
  const formIsValid = nativeFormIsValid && emailIsStudentAddress && !facultyUnavailable && !studyProgramDisabled && Boolean(selectedFacultyId) && Boolean(selectedStudyProgramId) && passwordMeetsPolicy && passwordsMatch;
  const registrationCompleted = signUpFeedback?.type === "success";
  const submitButtonDisabled = !formIsValid || isSubmitting || registrationCompleted;

  function handleFacultyChange(event: ChangeEvent<HTMLSelectElement>) {
    setSelectedFacultyId(event.target.value);
    setSelectedStudyProgramId("");
  }

  function handleFormValidityChange(event: FormEvent<HTMLFormElement>) {
    setNativeFormIsValid(event.currentTarget.checkValidity());
  }

  function handlePasswordChange(event: ChangeEvent<HTMLInputElement>) {
    const nextPassword = event.target.value;
    setPassword(nextPassword);
    passwordConfirmationInputRef.current?.setCustomValidity(passwordConfirmation.length > 0 && passwordConfirmation !== nextPassword ? PASSWORD_MISMATCH_MESSAGE : "");
  }

  function handlePasswordConfirmationChange(event: ChangeEvent<HTMLInputElement>) {
    const nextConfirmation = event.target.value;
    setPasswordConfirmation(nextConfirmation);
    event.currentTarget.setCustomValidity(nextConfirmation.length > 0 && nextConfirmation !== password ? PASSWORD_MISMATCH_MESSAGE : "");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (signUpInProgressRef.current || isSubmitting || registrationCompleted || !formIsValid) return;

    const formData = new FormData(event.currentTarget);
    const submittedEmail = formData.get("email");
    const fullName = formData.get("fullName");
    const entryYearValue = formData.get("entryYear");
    const termsAccepted = formData.get("termsAccepted") !== null;
    if (typeof submittedEmail !== "string" || typeof fullName !== "string" || typeof entryYearValue !== "string" || !termsAccepted) {
      setSignUpFeedback({ type: "error", message: "Data pendaftaran belum lengkap. Periksa kembali form Anda." });
      return;
    }
    if (!STUDENT_EMAIL_PATTERN.test(submittedEmail)) {
      setSignUpFeedback({ type: "error", message: STUDENT_EMAIL_ERROR_MESSAGE });
      return;
    }
    const entryYear = Number(entryYearValue);
    if (!Number.isInteger(entryYear)) {
      setSignUpFeedback({ type: "error", message: "Tahun masuk tidak valid. Periksa kembali form Anda." });
      return;
    }

    signUpInProgressRef.current = true;
    setIsSubmitting(true);
    setSignUpFeedback(null);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email: submittedEmail,
        password,
        options: { data: { nama_lengkap: fullName, nim, program_studi_id: selectedStudyProgramId, tahun_masuk: entryYear, accepted_terms_at: new Date().toISOString() } },
      });
      if (error) {
        setSignUpFeedback({ type: "error", message: getSafeSignUpErrorMessage(error) });
        return;
      }
      if (!data.user) {
        setSignUpFeedback({ type: "error", message: "Akun belum dapat dibuat. Silakan coba lagi." });
        return;
      }
      if (data.session) {
        setSignUpFeedback({ type: "success", message: "Akun berhasil dibuat. Mengarahkan ke onboarding..." });
        router.replace("/onboarding");
        return;
      }
      setSignUpFeedback({ type: "success", message: "Akun berhasil dibuat. Silakan periksa email Anda untuk mengonfirmasi akun sebelum melanjutkan." });
    } catch {
      setSignUpFeedback({ type: "error", message: "Terjadi gangguan saat membuat akun. Periksa koneksi Anda lalu coba lagi." });
    } finally {
      signUpInProgressRef.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <form className="grid gap-x-6 gap-y-5 sm:grid-cols-2" onSubmit={handleSubmit} onChange={handleFormValidityChange} onInput={handleFormValidityChange} aria-busy={isSubmitting}>
      <div className="sm:col-span-2">
        <label htmlFor="email" className="mb-2 block text-sm font-semibold text-slate-700">Email Mahasiswa UNESA</label>
        <input id="email" name="email" type="email" autoComplete="email" placeholder="nama@mhs.unesa.ac.id" value={email} onChange={(event) => setEmail(event.target.value)} pattern={STUDENT_EMAIL_PATTERN.source} aria-invalid={emailHasDomainError} aria-describedby={emailHasDomainError ? "email-error" : undefined} className={inputClassName} required />
        {emailHasDomainError && <p id="email-error" role="alert" className="mt-2 text-xs text-red-600">{STUDENT_EMAIL_ERROR_MESSAGE}</p>}
      </div>
      <PasswordField value={password} onChange={handlePasswordChange} meetsPolicy={passwordMeetsPolicy} requirements={passwordRequirements} />
      <PasswordConfirmationField inputRef={passwordConfirmationInputRef} value={passwordConfirmation} onChange={handlePasswordConfirmationChange} mismatch={passwordConfirmationMismatch} mismatchMessage={PASSWORD_MISMATCH_MESSAGE} />
      <AcademicFields nim={nim} nimTouched={nimTouched} nimIsEmpty={nimIsEmpty} nimHasInvalidLength={nimHasInvalidLength} nimHasNonDigitCharacters={nimHasNonDigitCharacters} nimHasVisibleError={nimHasVisibleError} onNimChange={(event) => setNim(event.target.value)} onNimBlur={() => setNimTouched(true)} faculties={faculties} filteredStudyPrograms={filteredStudyPrograms} selectedFacultyId={selectedFacultyId} selectedStudyProgramId={selectedStudyProgramId} onFacultyChange={handleFacultyChange} onStudyProgramChange={(event) => setSelectedStudyProgramId(event.target.value)} facultyLoadFailed={facultyLoadFailed} studyProgramLoadFailed={studyProgramLoadFailed} facultyDataEmpty={facultyDataEmpty} studyProgramDataEmpty={studyProgramDataEmpty} facultyUnavailable={facultyUnavailable} studyProgramUnavailable={studyProgramUnavailable} selectedFacultyHasNoStudyPrograms={selectedFacultyHasNoStudyPrograms} studyProgramDisabled={studyProgramDisabled} />
      <div className="sm:col-span-2">
        <label className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-slate-600"><input name="termsAccepted" type="checkbox" className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 accent-indigo-600" required /><span>Saya telah membaca dan menyetujui <span className="font-semibold text-indigo-600">Syarat &amp; Ketentuan</span> yang berlaku.</span></label>
      </div>
      <div className="sm:col-span-2">
        <button type="submit" disabled={submitButtonDisabled} className={!submitButtonDisabled ? "flex h-12 w-full cursor-pointer items-center justify-center rounded-xl bg-indigo-600 px-5 text-sm font-bold text-white transition hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-200" : "flex h-12 w-full cursor-not-allowed items-center justify-center rounded-xl bg-indigo-300 px-5 text-sm font-bold text-white opacity-75 transition"}>{isSubmitting ? "Membuat akun..." : "Daftar"}</button>
        <div aria-live="polite" className="mt-3 min-h-5 text-center text-xs">{isSubmitting ? <p role="status" className="text-slate-500">Membuat akun...</p> : signUpFeedback && <p role={signUpFeedback.type === "error" ? "alert" : "status"} className={signUpFeedback.type === "error" ? "text-red-600" : "text-emerald-600"}>{signUpFeedback.message}</p>}</div>
      </div>
    </form>
  );
}
