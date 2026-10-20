export type CreateSquadPrimaryClass = {
  primary_class_id: number;
  nama_class: string;
};

export type RequirementRow = {
  id: number;
  primaryClassId: string;
  slots: string;
};

export type RequirementErrors = Record<
  number,
  {
    primaryClassId?: string;
    slots?: string;
  }
>;

export type FormErrors = {
  form?: string;
  namaSquad?: string;
  deskripsiSquad?: string;
  kapasitasAnggota?: string;
  requirements?: string;
  requirementRows?: RequirementErrors;
};

export type SubmitFeedback =
  | { type: "success"; message: string }
  | { type: "error"; message: string }
  | null;
