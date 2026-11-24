import type {
  ExamSchedule,
  Inscription,
  Student,
} from "../shared/schema.js";
import type { IStorage } from "./storage.js";

type ActiveCallStorage = Pick<
  IStorage,
  | "getActiveExamCall"
  | "getAllStudents"
  | "getExamSchedulesByExamCallId"
  | "getInscriptionsByExamCallId"
>;

export type HydratedInscription = Inscription & {
  student: Student | undefined;
  examSchedules: Array<ExamSchedule & { condition: string }>;
};

export async function loadActiveCallInscriptions(
  storage: ActiveCallStorage,
): Promise<HydratedInscription[]> {
  const activeCall = await storage.getActiveExamCall();
  if (!activeCall) return [];

  const [inscriptions, students, examSchedules] = await Promise.all([
    storage.getInscriptionsByExamCallId(activeCall.id),
    storage.getAllStudents(),
    storage.getExamSchedulesByExamCallId(activeCall.id),
  ]);

  return hydrateInscriptions(inscriptions, students, examSchedules);
}

export function hydrateInscriptions(
  inscriptions: readonly Inscription[],
  students: readonly Student[],
  examSchedules: readonly ExamSchedule[],
): HydratedInscription[] {
  const studentsById = new Map(students.map((student) => [student.id, student]));
  const schedulesById = new Map(
    examSchedules.map((schedule) => [schedule.id, schedule]),
  );

  return inscriptions.map((inscription) => ({
    ...inscription,
    student: studentsById.get(inscription.studentId),
    examSchedules: inscription.examScheduleIds.flatMap((scheduleId, index) => {
      const schedule = schedulesById.get(Number(scheduleId));
      return schedule
        ? [{ ...schedule, condition: inscription.examConditions?.[index] ?? "regular" }]
        : [];
    }),
  }));
}
