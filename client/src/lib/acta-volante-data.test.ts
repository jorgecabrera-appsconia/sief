import { describe, expect, it } from "vitest";
import type { ExamSchedule, Inscription, Student } from "@shared/schema";
import {
  buildActaSections,
  type ActaSourceInscription,
} from "./acta-volante-data";

const createdAt = new Date("2026-11-26T12:00:00.000Z");

function student(id: number, lastName: string): Student {
  return {
    id,
    firstName: `Nombre ${id}`,
    lastName,
    dni: String(30_000_000 + id),
    phone: "3804000000",
    email: `student-${id}@example.com`,
    profesorado: "Biología",
    turno: "siesta",
    year: 2,
    division: "A",
    yearEntered: 2025,
    createdAt,
  };
}

function inscription(
  id: number,
  studentRecord: Student,
  status: Inscription["status"],
  schedules: Array<{ id: number; condition: "regular" | "libre" }>,
): ActaSourceInscription {
  return {
    id,
    studentId: studentRecord.id,
    examScheduleIds: schedules.map((schedule) => String(schedule.id)),
    examConditions: schedules.map((schedule) => schedule.condition),
    status,
    confirmedBy: null,
    confirmedAt: null,
    permissionNumber: null,
    createdAt,
    student: studentRecord,
    examSchedules: schedules as Array<Pick<ExamSchedule, "id"> & {
      condition: "regular" | "libre";
    }>,
  };
}

describe("buildActaSections", () => {
  it("separates confirmed students by the condition of the selected schedule", () => {
    const ana = student(1, "Álvarez");
    const bruno = student(2, "Benítez");
    const carla = student(3, "Cáceres");

    const sections = buildActaSections(20, [
      inscription(1, ana, "confirmed", [
        { id: 20, condition: "regular" },
        { id: 21, condition: "libre" },
      ]),
      inscription(2, bruno, "confirmed", [{ id: 20, condition: "libre" }]),
      inscription(3, carla, "pending", [{ id: 20, condition: "regular" }]),
    ]);

    expect(sections).toEqual([
      { condition: "regular", students: [ana] },
      { condition: "libre", students: [bruno] },
    ]);
  });

  it("does not include a same-subject inscription from another schedule", () => {
    const ana = student(1, "Álvarez");
    const sections = buildActaSections(20, [
      inscription(1, ana, "confirmed", [{ id: 21, condition: "libre" }]),
    ]);

    expect(sections).toEqual([]);
  });

  it("uses regular as the safe default when a legacy condition is missing", () => {
    const ana = student(1, "Álvarez");
    const legacy = inscription(1, ana, "confirmed", [{ id: 20, condition: "regular" }]);
    legacy.examSchedules = [{ id: 20 }];

    expect(buildActaSections(20, [legacy])).toEqual([
      { condition: "regular", students: [ana] },
    ]);
  });
});
