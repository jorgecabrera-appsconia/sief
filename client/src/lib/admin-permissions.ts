export type AdminRole = "bedel" | "admin" | "superadmin";

export type AdminTab =
  | "inscriptions"
  | "exams"
  | "exam-calls"
  | "subjects"
  | "users";

const visibleTabsByRole: Record<AdminRole, readonly AdminTab[]> = {
  bedel: ["inscriptions", "exams"],
  admin: ["inscriptions", "exams", "exam-calls", "subjects"],
  superadmin: ["inscriptions", "exams", "exam-calls", "subjects", "users"],
};

export function getVisibleAdminTabs(role: AdminRole): AdminTab[] {
  return [...visibleTabsByRole[role]];
}

export function canManageExamConfiguration(role: AdminRole): boolean {
  return role === "admin" || role === "superadmin";
}
