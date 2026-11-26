import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { ExamSchedule } from "@shared/schema";
import type { ActaCondition, ActaSection } from "./acta-volante-data";

export interface ActaVolanteData {
  examSchedule: ExamSchedule;
  sections: ActaSection[];
}

const PAGE_BOTTOM = 267;
const CLOSING_BLOCK_HEIGHT = 56;
const MAX_MANUAL_ROWS = 5;

const tableHead = [
  [
    { content: "N°", rowSpan: 2 },
    { content: "APELLIDO Y NOMBRE", rowSpan: 2 },
    { content: "Calificaciones", colSpan: 3 },
    { content: "N° de Bol.", colSpan: 2 },
    { content: "Documento de Identidad", rowSpan: 2 },
  ],
  ["Esc.", "Oral", "Prom.", "Esc.", "Oral"],
];

const tableColumnStyles = {
  0: { cellWidth: 10 },
  1: { halign: "left" as const, cellWidth: 60 },
  2: { cellWidth: 15 },
  3: { cellWidth: 15 },
  4: { cellWidth: 15 },
  5: { cellWidth: 15 },
  6: { cellWidth: 15 },
  7: { cellWidth: 35 },
};

function conditionLabel(condition: ActaCondition) {
  return condition === "libre" ? "ALUMNOS LIBRES" : "ALUMNOS REGULARES";
}

function drawActaHeader(
  doc: jsPDF,
  examSchedule: ExamSchedule,
  condition: ActaCondition,
  continuation: boolean,
) {
  const pageWidth = doc.internal.pageSize.width;

  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("INSTITUTO SUPERIOR DE FORMACIÓN DOCENTE", pageWidth / 2, 18, {
    align: "center",
  });
  doc.text('"DR. PEDRO IGNACIO DE CASTRO BARROS"', pageWidth / 2, 25, {
    align: "center",
  });

  doc.setFontSize(13);
  doc.text("ACTA VOLANTE DE EXÁMENES", pageWidth / 2, 35, { align: "center" });
  doc.setFontSize(10);
  doc.text(conditionLabel(condition), pageWidth / 2, 42, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  if (continuation) {
    doc.text(
      `Continuación - ${examSchedule.subject} - ${examSchedule.date}`,
      pageWidth / 2,
      50,
      { align: "center" },
    );
    return 58;
  }

  const folioX = pageWidth - 50;
  doc.text("Folio:", folioX, 50);
  doc.line(folioX + 18, 50, folioX + 42, 50);

  doc.text("Acta de Estudiantes:", 20, 58);
  doc.text(`Carrera: ${examSchedule.profesorado}`, 80, 58);
  doc.text("Fecha:      /      /         ", 160, 58);
  doc.text(`Espacio Curricular: ${examSchedule.subject}`, 20, 66);
  doc.text(
    `Año: ${examSchedule.year}° Turno: ${examSchedule.turno.charAt(0).toUpperCase() + examSchedule.turno.slice(1)}`,
    160,
    66,
  );
  if (examSchedule.division) {
    doc.text(`División: ${examSchedule.division}`, 160, 74);
  }

  return 82;
}

function studentRows(section: ActaSection, manualRows = 0) {
  return [
    ...section.students.map((student, index) => [
    String(index + 1),
    `${student.lastName}, ${student.firstName}`,
    "",
    "",
    "",
    "",
    "",
    String(student.dni),
    ]),
    ...Array.from({ length: manualRows }, () => ["", "", "", "", "", "", "", ""]),
  ];
}

function manualRowCount(examSchedule: ExamSchedule, section: ActaSection) {
  const preview = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const startY = drawActaHeader(preview, examSchedule, section.condition, false);
  autoTable(preview, {
    startY,
    head: tableHead,
    body: studentRows(section),
    theme: "grid",
    styles: { fontSize: 10, cellPadding: 2, halign: "center" },
    headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: "bold", halign: "center" },
    columnStyles: tableColumnStyles,
    tableWidth: 180,
    margin: { top: 58, left: 15, right: 15, bottom: 45 },
    pageBreak: "auto",
    rowPageBreak: "avoid",
    showHead: "everyPage",
  });

  if (preview.getNumberOfPages() > 1) return 0;
  const finalY = (preview as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  return Math.max(
    0,
    Math.min(MAX_MANUAL_ROWS, Math.floor((PAGE_BOTTOM - CLOSING_BLOCK_HEIGHT - finalY) / 10)),
  );
}

function drawClosingBlock(
  doc: jsPDF,
  examSchedule: ExamSchedule,
  totalStudents: number,
  startY: number,
) {
  const tribunalData = [
    ["Presidente:", examSchedule.presidente, "Total de Alumnos:", String(totalStudents)],
    ["Vocal:", examSchedule.vocal1, "Aprobados:", ""],
    ["Vocal:", examSchedule.vocal2, "Aplazados:", ""],
    ["Vocal Suplente:", examSchedule.vocalSuplente, "Ausentes:", ""],
  ];

  autoTable(doc, {
    startY,
    body: tribunalData,
    theme: "grid",
    styles: { fontSize: 10 },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 25 },
      1: { cellWidth: 80 },
      2: { fontStyle: "bold", cellWidth: 35 },
      3: { cellWidth: 30 },
    },
    tableWidth: 170,
    margin: { left: 15, right: 15, bottom: 20 },
    tableLineColor: [0, 0, 0],
    tableLineWidth: 0.5,
    pageBreak: "avoid",
    rowPageBreak: "avoid",
  });

  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(
    "La Rioja, ...................... de ..................................... de 2026",
    doc.internal.pageSize.width / 2,
    finalY + 10,
    { align: "center" },
  );
}

function addPageNumbers(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;

  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setTextColor(128, 128, 128);
    doc.setFontSize(8);
    doc.text(`Página ${page} de ${pageCount}`, pageWidth - 15, pageHeight - 8, {
      align: "right",
    });
  }
  doc.setTextColor(0, 0, 0);
}

export function buildActaVolantePDF(data: ActaVolanteData) {
  const { examSchedule, sections } = data;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  sections.forEach((section, sectionIndex) => {
    if (sectionIndex > 0) doc.addPage();

    const firstPageTableY = 82;

    const manualRows = manualRowCount(examSchedule, section);
    autoTable(doc, {
      startY: firstPageTableY,
      head: tableHead,
      body: studentRows(section, manualRows),
      theme: "grid",
      styles: { fontSize: 10, cellPadding: 2, halign: "center" },
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontStyle: "bold",
        halign: "center",
      },
      columnStyles: tableColumnStyles,
      tableWidth: 180,
      tableLineColor: [0, 0, 0],
      tableLineWidth: 0.5,
      margin: { top: 58, left: 15, right: 15, bottom: 45 },
      pageBreak: "auto",
      rowPageBreak: "avoid",
      showHead: "everyPage",
      willDrawPage: ({ pageNumber }) => {
        drawActaHeader(doc, examSchedule, section.condition, pageNumber > 1);
      },
    });

    let finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

    if (finalY + CLOSING_BLOCK_HEIGHT > PAGE_BOTTOM) {
      doc.addPage();
      finalY = drawActaHeader(doc, examSchedule, section.condition, true);
    }
    drawClosingBlock(doc, examSchedule, section.students.length, finalY + 8);
  });

  addPageNumbers(doc);
  return doc;
}

export function generateActaVolantePDF(data: ActaVolanteData) {
  const doc = buildActaVolantePDF(data);
  const { examSchedule } = data;
  const fileName = `Acta_Volante_${examSchedule.subject}_${examSchedule.year}año_${examSchedule.turno}_${examSchedule.date}.pdf`;
  doc.save(fileName);
}
