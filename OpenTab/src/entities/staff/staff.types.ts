// Autor: Boško Trifunović ([student ID omitted]) - SSU16-20
export type StaffRole = string;

export type StaffStatus = "active" | "inactive";

export type StaffGender = "male" | "female" | "other";

export type StaffMember = {
  id: string;
  fullName: string;
  username: string;
  password: string;
  role: StaffRole;
  status: StaffStatus;
  gender: StaffGender;
  avatarUrl: string;
  createdAt: string;
  updatedAt: string;
};

export type StaffFormValues = {
  fullName: string;
  username: string;
  password: string;
  role: StaffRole;
  gender: StaffGender;
  avatarUrl: string;
};

export type StaffFormErrors = Partial<Record<keyof StaffFormValues, string>> & {
  general?: string;
};

export type StaffStatusFilter = "all" | StaffStatus;

export type StaffRoleFilter = "all" | StaffRole;

export type RoleMutationValues = {
  name: string;
  icon: string;
  workerIds: string[];
};

export type ActionResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      message: string;
    };