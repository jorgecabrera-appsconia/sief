import { describe, expect, it } from "vitest";
import { Packer } from "docx";
import type { ExamSchedule, Student } from "@shared/schema";
import type { ActaSection } from "./acta-volante-data";
import { buildActaVolanteDOCX } from "./acta-volante-docx-generator";

const createdAt = new Date("2026-11-26T12:00:00.000Z");
const examSchedule: ExamSchedule = {
  id: 20,
  examCallId: 7,
  subject: "Didáctica General",
  year: 2,
  profesorado: "Educación Primaria",
  turno: "siesta",
  division: "A",
  date: "2026-12-01",
  time: "18:00",
  teacher: "Docente",
  presidente: "Presidente",
  vocal1: "Vocal Uno",
  vocal2: "Vocal Dos",
  vocalSuplente: "Vocal Suplente",
  period: "Noviembre 2026",
  registrationOpen: true,
  createdAt,
};

function student(id: number): Student {
  return {
    id,
    firstName: `Nombre ${id}`,
    lastName: `Apellido ${id}`,
    dni: String(30_000_000 + id),
    phone: "3804000000",
    email: `student-${id}@example.com`,
    profesorado: examSchedule.profesorado,
    turno: examSchedule.turno,
    year: examSchedule.year,
    division: examSchedule.division,
    yearEntered: 2025,
    createdAt,
  };
}

describe("buildActaVolanteDOCX", () => {
  it("packs both condition actas into one valid DOCX document", async () => {
    const sections: ActaSection[] = [
      { condition: "regular", students: [student(1)] },
      { condition: "libre", students: [student(2)] },
    ];

    const document = buildActaVolanteDOCX({ examSchedule, sections });
    const buffer = await Packer.toBuffer(document);

    expect(buffer.byteLength).toBeGreaterThan(1_000);
  });
});
