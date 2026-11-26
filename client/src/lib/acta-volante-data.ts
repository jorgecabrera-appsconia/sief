import type { ExamSchedule, Inscription, Student } from "@shared/schema";

export type ActaCondition = "regular" | "libre";

export type ActaSourceInscription = Inscription & {
  student?: Student | null;
  examSchedules?: Array<Pick<ExamSchedule, "id"> & { condition?: string | null }>;
};

export type ActaSection = {
  condition: ActaCondition;
  students: Student[];
};

export function buildActaSections(
  examScheduleId: number,
  inscriptions: readonly ActaSourceInscription[],
): ActaSection[] {
  const studentsByCondition: Record<ActaCondition, Student[]> = {
    regular: [],
    libre: [],
  };

  for (const inscription of inscriptions) {
    if (inscription.status !== "confirmed" || !inscription.student) continue;

    const selectedSchedule = inscription.examSchedules?.find(
      (schedule) => schedule.id === examScheduleId,
    );
    if (!selectedSchedule) continue;

    const condition: ActaCondition =
      selectedSchedule.condition === "libre" ? "libre" : "regular";
    studentsByCondition[condition].push(inscription.student);
  }

  return (["regular", "libre"] as const)
    .filter((condition) => studentsByCondition[condition].length > 0)
    .map((condition) => ({
      condition,
      students: studentsByCondition[condition],
    }));
}
