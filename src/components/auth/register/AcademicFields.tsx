import type { ChangeEvent } from "react";

import type { FacultyOption, StudyProgramOption } from "./registerTypes";

const inputClassName =
  "h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100";
const selectClassName =
  "h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500";

type AcademicFieldsProps = {
  nim: string;
  nimTouched: boolean;
  nimIsEmpty: boolean;
  nimHasInvalidLength: boolean;
  nimHasNonDigitCharacters: boolean;
  nimHasVisibleError: boolean;
  onNimChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onNimBlur: () => void;
  faculties: FacultyOption[];
  filteredStudyPrograms: StudyProgramOption[];
  selectedFacultyId: string;
  selectedStudyProgramId: string;
  onFacultyChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  onStudyProgramChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  facultyLoadFailed: boolean;
  studyProgramLoadFailed: boolean;
  facultyDataEmpty: boolean;
  studyProgramDataEmpty: boolean;
  facultyUnavailable: boolean;
  studyProgramUnavailable: boolean;
  selectedFacultyHasNoStudyPrograms: boolean;
  studyProgramDisabled: boolean;
};

export default function AcademicFields(props: AcademicFieldsProps) {
  let facultyPlaceholder = "Pilih Fakultas";
  if (props.facultyLoadFailed) facultyPlaceholder = "Data fakultas gagal dimuat";
  else if (props.facultyDataEmpty) facultyPlaceholder = "Data fakultas belum tersedia";

  let studyProgramPlaceholder = "Pilih Program Studi";
  if (props.studyProgramLoadFailed) studyProgramPlaceholder = "Data program studi gagal dimuat";
  else if (props.studyProgramDataEmpty) studyProgramPlaceholder = "Data program studi belum tersedia";
  else if (!props.selectedFacultyId) studyProgramPlaceholder = "Pilih Fakultas terlebih dahulu";
  else if (props.selectedFacultyHasNoStudyPrograms) studyProgramPlaceholder = "Program Studi tidak tersedia";

  return (
    <>
      <div>
        <label htmlFor="full-name" className="mb-2 block text-sm font-semibold text-slate-700">Nama Lengkap</label>
        <input id="full-name" name="fullName" type="text" autoComplete="name" placeholder="Masukkan nama lengkap" className={inputClassName} required />
      </div>
      <div>
        <label htmlFor="nim" className="mb-2 block text-sm font-semibold text-slate-700">NIM</label>
        <input id="nim" name="nim" type="text" inputMode="numeric" autoComplete="off" placeholder="Contoh: 24081494xxx" value={props.nim} onChange={props.onNimChange} onBlur={props.onNimBlur} pattern="[0-9]{11}" aria-invalid={props.nimHasVisibleError} aria-describedby={props.nimHasVisibleError ? "nim-error" : undefined} className={inputClassName} required />
        {props.nimHasVisibleError && (
          <div id="nim-error" role="alert" className="mt-2 space-y-1 text-xs text-red-600">
            {props.nimTouched && props.nimIsEmpty && <p>NIM wajib diisi.</p>}
            {props.nimHasInvalidLength && <p>NIM harus terdiri dari 11 digit.</p>}
            {props.nimHasNonDigitCharacters && <p>NIM hanya boleh berisi digit 0-9.</p>}
          </div>
        )}
      </div>
      <div>
        <label htmlFor="faculty" className="mb-2 block text-sm font-semibold text-slate-700">Fakultas</label>
        <select id="faculty" name="facultyId" value={props.selectedFacultyId} onChange={props.onFacultyChange} className={selectClassName} disabled={props.facultyUnavailable} aria-describedby={props.facultyUnavailable ? "faculty-status" : undefined} required>
          <option value="" disabled>{facultyPlaceholder}</option>
          {props.faculties.map((faculty) => <option key={faculty.fakultas_id} value={faculty.fakultas_id}>{faculty.nama_fakultas}</option>)}
        </select>
        {props.facultyUnavailable && <p id="faculty-status" role={props.facultyLoadFailed ? "alert" : "status"} className={props.facultyLoadFailed ? "mt-2 text-xs text-red-600" : "mt-2 text-xs text-slate-500"}>{props.facultyLoadFailed ? "Data fakultas belum dapat dimuat. Silakan coba lagi nanti." : "Data fakultas belum tersedia."}</p>}
      </div>
      <div>
        <label htmlFor="study-program" className="mb-2 block text-sm font-semibold text-slate-700">Program Studi</label>
        <select id="study-program" name="studyProgramId" value={props.selectedStudyProgramId} onChange={props.onStudyProgramChange} className={selectClassName} disabled={props.studyProgramDisabled} aria-describedby={props.studyProgramUnavailable || props.selectedFacultyHasNoStudyPrograms ? "study-program-status" : undefined} required>
          <option value="" disabled>{studyProgramPlaceholder}</option>
          {props.filteredStudyPrograms.map((program) => <option key={program.program_studi_id} value={program.program_studi_id}>{program.nama_program_studi}</option>)}
        </select>
        {(props.studyProgramUnavailable || props.selectedFacultyHasNoStudyPrograms) && <p id="study-program-status" role={props.studyProgramLoadFailed ? "alert" : "status"} className={props.studyProgramLoadFailed ? "mt-2 text-xs text-red-600" : "mt-2 text-xs text-slate-500"}>{props.studyProgramLoadFailed ? "Data program studi belum dapat dimuat. Silakan coba lagi nanti." : props.studyProgramDataEmpty ? "Data program studi belum tersedia." : "Belum ada program studi untuk fakultas ini."}</p>}
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="entry-year" className="mb-2 block text-sm font-semibold text-slate-700">Tahun Masuk</label>
        <input id="entry-year" name="entryYear" type="number" inputMode="numeric" min="2000" max="2100" placeholder="Contoh: 2026" className={inputClassName} required />
      </div>
    </>
  );
}
