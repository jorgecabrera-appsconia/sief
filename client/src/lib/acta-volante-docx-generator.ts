import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Packer,
  PageBreak,
  PageNumber,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { saveAs } from "file-saver";
import type { ExamSchedule, Student } from "@shared/schema";
import type { ActaCondition, ActaSection } from "./acta-volante-data";

export interface ActaVolanteDocxData {
  examSchedule: ExamSchedule;
  sections: ActaSection[];
}

const MAX_ROWS_PER_FINAL_PAGE = 13;
const MAX_MANUAL_ROWS = 5;
const borders = {
  top: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
  left: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
  right: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
};

function conditionLabel(condition: ActaCondition) {
  return condition === "libre" ? "ALUMNOS LIBRES" : "ALUMNOS REGULARES";
}

function paragraph(
  text: string,
  options: {
    bold?: boolean;
    size?: number;
    alignment?: (typeof AlignmentType)[keyof typeof AlignmentType];
    after?: number;
    before?: number;
  } = {},
) {
  return new Paragraph({
    children: [new TextRun({ text, bold: options.bold, size: options.size ?? 20 })],
    alignment: options.alignment,
    spacing: { after: options.after, before: options.before },
  });
}

function cell(
  text: string,
  width: number,
  options: { bold?: boolean; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; rowSpan?: number; columnSpan?: number } = {},
) {
  return new TableCell({
    children: [paragraph(text, { bold: options.bold, alignment: options.align ?? AlignmentType.CENTER })],
    width: { size: width, type: WidthType.PERCENTAGE },
    rowSpan: options.rowSpan,
    columnSpan: options.columnSpan,
    borders,
  });
}

function multiLineCell(
  lines: string[],
  width: number,
  options: { bold?: boolean; align?: (typeof AlignmentType)[keyof typeof AlignmentType] } = {},
) {
  return new TableCell({
    children: lines.map((line, index) => paragraph(line, {
      bold: options.bold,
      alignment: options.align ?? AlignmentType.CENTER,
      after: index === lines.length - 1 ? undefined : 80,
    })),
    width: { size: width, type: WidthType.PERCENTAGE },
    borders,
  });
}

function studentRow(student: Student, index: number) {
  return new TableRow({
    cantSplit: true,
    children: [
      cell(String(index + 1), 6),
      cell(`${student.lastName}, ${student.firstName}`, 35, { align: AlignmentType.LEFT }),
      cell("", 10),
      cell("", 10),
      cell("", 10),
      cell("", 7),
      cell("", 8),
      cell(String(student.dni), 14),
    ],
  });
}

function emptyStudentRow() {
  return new TableRow({
    cantSplit: true,
    children: [
      cell("", 6),
      cell("", 35, { align: AlignmentType.LEFT }),
      cell("", 10),
      cell("", 10),
      cell("", 10),
      cell("", 7),
      cell("", 8),
      cell("", 14),
    ],
  });
}

function studentsTable(section: ActaSection) {
  const manualRows =
    section.students.length < MAX_ROWS_PER_FINAL_PAGE
      ? Math.min(MAX_MANUAL_ROWS, MAX_ROWS_PER_FINAL_PAGE - section.students.length)
      : 0;

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        cantSplit: true,
        children: [
          cell("N°", 6, { bold: true, rowSpan: 2 }),
          cell("APELLIDO Y NOMBRE", 35, { bold: true, rowSpan: 2 }),
          cell("Calificaciones", 30, { bold: true, columnSpan: 3 }),
          cell("N° de Bol.", 15, { bold: true, columnSpan: 2 }),
          cell("Documento de Identidad", 14, { bold: true, rowSpan: 2 }),
        ],
      }),
      new TableRow({
        tableHeader: true,
        cantSplit: true,
        children: [
          cell("Esc.", 10, { bold: true }),
          cell("Oral", 10, { bold: true }),
          cell("Prom.", 10, { bold: true }),
          cell("Esc.", 7, { bold: true }),
          cell("Oral", 8, { bold: true }),
        ],
      }),
      ...section.students.map(studentRow),
      ...Array.from({ length: manualRows }, emptyStudentRow),
    ],
  });
}

function closingBlock(examSchedule: ExamSchedule, totalStudents: number) {
  return [
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          cantSplit: true,
          children: [
            multiLineCell(["Presidente:", "Vocal:", "Vocal:", "Vocal Suplente:"], 15, {
              bold: true,
              align: AlignmentType.LEFT,
            }),
            multiLineCell([examSchedule.presidente, examSchedule.vocal1, examSchedule.vocal2, examSchedule.vocalSuplente], 35, {
              align: AlignmentType.LEFT,
            }),
            multiLineCell(["Total de Alumnos:", "Aprobados:", "Aplazados:", "Ausentes:"], 25, {
              bold: true,
              align: AlignmentType.LEFT,
            }),
            multiLineCell([String(totalStudents), "", "", ""], 25),
          ],
        }),
      ],
    }),
    paragraph(
      "La Rioja, ...................... de ..................................... de 2026",
      { alignment: AlignmentType.CENTER, before: 240 },
    ),
  ];
}

function sectionChildren(
  examSchedule: ExamSchedule,
  section: ActaSection,
  startsOnNewPage: boolean,
) {
  return [
    ...(startsOnNewPage ? [new Paragraph({ children: [new PageBreak()] })] : []),
    paragraph("INSTITUTO SUPERIOR DE FORMACIÓN DOCENTE", {
      bold: true,
      size: 24,
      alignment: AlignmentType.CENTER,
      after: 80,
    }),
    paragraph('"DR. PEDRO IGNACIO DE CASTRO BARROS"', {
      bold: true,
      size: 24,
      alignment: AlignmentType.CENTER,
      after: 160,
    }),
    paragraph("ACTA VOLANTE DE EXÁMENES", {
      bold: true,
      size: 28,
      alignment: AlignmentType.CENTER,
      after: 80,
    }),
    paragraph(conditionLabel(section.condition), {
      bold: true,
      size: 22,
      alignment: AlignmentType.CENTER,
      after: 160,
    }),
    paragraph("Folio: ___________", { alignment: AlignmentType.RIGHT, after: 160 }),
    paragraph(
      `Acta de Estudiantes: _______________     Carrera: ${examSchedule.profesorado}     Fecha: ___/___/_____`,
      { after: 80 },
    ),
    paragraph(
      `Espacio Curricular: ${examSchedule.subject}     Año: ${examSchedule.year}° Turno: ${examSchedule.turno.charAt(0).toUpperCase() + examSchedule.turno.slice(1)}`,
      { after: examSchedule.division ? 80 : 160 },
    ),
    ...(examSchedule.division
      ? [paragraph(`División: ${examSchedule.division}`, { alignment: AlignmentType.RIGHT, after: 160 })]
      : []),
    studentsTable(section),
    paragraph("", { after: 160 }),
    ...closingBlock(examSchedule, section.students.length),
  ];
}

export function buildActaVolanteDOCX(data: ActaVolanteDocxData) {
  const { examSchedule, sections } = data;
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 720, right: 720, bottom: 720, left: 720 },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({ text: "Página " }),
                  new TextRun({ children: [PageNumber.CURRENT] }),
                  new TextRun({ text: " de " }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES] }),
                ],
              }),
            ],
          }),
        },
        children: sections.flatMap((section, index) =>
          sectionChildren(examSchedule, section, index > 0),
        ),
      },
    ],
  });

  return doc;
}

export async function generateActaVolanteDOCX(data: ActaVolanteDocxData) {
  const doc = buildActaVolanteDOCX(data);
  const buffer = await Packer.toBlob(doc);
  const { examSchedule } = data;
  const fileName = `Acta_Volante_${examSchedule.subject}_${examSchedule.year}año_${examSchedule.turno}_${examSchedule.date}.docx`;
  saveAs(buffer, fileName);
}
