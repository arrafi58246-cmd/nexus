import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import RegisterForm, {
  type FacultyOption,
  type StudyProgramOption,
} from "@/components/auth/RegisterForm";

export default async function RegisterPage() {
  const supabase = await createClient();
  const [
    { data: facultyData, error: facultyError },
    { data: studyProgramData, error: studyProgramError },
  ] = await Promise.all([
    supabase
      .from("fakultas")
      .select("fakultas_id, nama_fakultas")
      .order("nama_fakultas", { ascending: true }),
    supabase
      .from("program_studi")
      .select("program_studi_id, fakultas_id, nama_program_studi")
      .order("nama_program_studi", { ascending: true }),
  ]);

  const faculties: FacultyOption[] = (facultyData ?? []).map((faculty) => ({
    fakultas_id: String(faculty.fakultas_id),
    nama_fakultas: faculty.nama_fakultas,
  }));

  const studyPrograms: StudyProgramOption[] = (studyProgramData ?? []).map(
    (studyProgram) => ({
      program_studi_id: String(studyProgram.program_studi_id),
      fakultas_id: String(studyProgram.fakultas_id),
      nama_program_studi: studyProgram.nama_program_studi,
    }),
  );

  return (
    <main className="nexus-auth-flow relative min-h-screen overflow-hidden bg-slate-50 px-4 py-10 text-slate-900 sm:px-6 lg:py-14">
      <div
        aria-hidden="true"
        className="absolute -left-32 -top-32 h-80 w-80 rounded-full bg-indigo-200/50 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-40 -right-32 h-96 w-96 rounded-full bg-violet-200/50 blur-3xl"
      />

      <div className="relative mx-auto w-full max-w-4xl">
        <header className="mb-8 text-center">
          <div className="mb-5 inline-flex items-center gap-3">
            <span className="nexus-brand"><Image src="/nexus-logo.svg" alt="" width={28} height={28} /></span>
            <span className="text-xl font-bold tracking-[0.22em] text-slate-900">
              NEXUS
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            Buat akun mahasiswa
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-500 sm:text-base">
            Lengkapi data diri Anda untuk bergabung dan terhubung di NEXUS.
          </p>
        </header>

        <section className="rounded-3xl border border-white/80 bg-white/90 p-6 shadow-xl shadow-slate-200/60 backdrop-blur sm:p-10">
          <RegisterForm
            faculties={faculties}
            studyPrograms={studyPrograms}
            facultyLoadFailed={Boolean(facultyError)}
            studyProgramLoadFailed={Boolean(studyProgramError)}
          />
        </section>
      </div>
    </main>
  );
}
