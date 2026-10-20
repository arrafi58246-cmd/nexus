export type FacultyOption = {
  fakultas_id: string;
  nama_fakultas: string;
};

export type StudyProgramOption = {
  program_studi_id: string;
  fakultas_id: string;
  nama_program_studi: string;
};

export type RegisterFormProps = {
  faculties: FacultyOption[];
  studyPrograms: StudyProgramOption[];
  facultyLoadFailed: boolean;
  studyProgramLoadFailed: boolean;
};

export type SignUpFeedback = {
  type: "error" | "success";
  message: string;
};

export type PasswordRequirement = {
  label: string;
  isMet: boolean;
};

export type SafeAuthError = {
  code?: string;
  status?: number;
};
