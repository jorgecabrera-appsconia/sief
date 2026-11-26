import { describe, expect, it } from "vitest";
import type { ExamSchedule, Student } from "@shared/schema";
import type { ActaSection } from "./acta-volante-data";
import { buildActaVolantePDF } from "./acta-volante-generator";

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
    firstName: `Nombre muy extenso ${id}`,
    lastName: `Apellido compuesto del estudiante ${id}`,
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

describe("buildActaVolantePDF", () => {
  it("creates a new acta page for each populated condition", () => {
    const sections: ActaSection[] = [
      { condition: "regular", students: [student(1)] },
      { condition: "libre", students: [student(2)] },
    ];

    const pdf = buildActaVolantePDF({ examSchedule, sections });
    const content = pdf.output();

    expect(pdf.getNumberOfPages()).toBe(2);
    expect(content).toContain("ALUMNOS REGULARES");
    expect(content).toContain("ALUMNOS LIBRES");
    expect(content).toContain("Total de Alumnos:");
  });

  it("paginates a long acta instead of forcing its table and closing block onto one page", () => {
    const pdf = buildActaVolantePDF({
      examSchedule,
      sections: [{ condition: "regular", students: Array.from({ length: 14 }, (_, index) => student(index + 1)) }],
    });

    expect(pdf.getNumberOfPages()).toBeGreaterThan(1);
    expect(pdf.output()).toContain("Página 1 de");
  });
});
