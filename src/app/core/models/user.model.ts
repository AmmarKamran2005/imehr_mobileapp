// Roles mirror the IMEHR backend enum exactly.
// See ehr-system/Models/Enums/AllEnums.cs and controller [Authorize(Roles="0,1,2,6,7")] gates.
export enum UserRole {
  SuperAdmin = 0,
  ClinicAdmin = 1,
  Clinician = 2,
  FrontDesk = 3,
  Biller = 4,
  Therapist = 5,
  MA = 6,
  Nurse = 7,
  Readonly = 8,
}

export interface CurrentUser {
  userId: number;
  fullName: string;
  email: string;
  role: UserRole;
  tenantId: number;
  tenantName: string;
  providerId?: number | null;
  mustChangePassword?: boolean;
}

export function isClinicianRole(r: UserRole): boolean {
  return r === UserRole.Clinician;
}

export function isNurseRole(r: UserRole): boolean {
  return r === UserRole.MA || r === UserRole.Nurse;
}

export function roleLabel(r: UserRole): 'Clinician' | 'Nurse' | 'Admin' | 'Staff' {
  if (isClinicianRole(r)) return 'Clinician';
  if (isNurseRole(r)) return 'Nurse';
  if (r === UserRole.ClinicAdmin || r === UserRole.SuperAdmin) return 'Admin';
  return 'Staff';
}
