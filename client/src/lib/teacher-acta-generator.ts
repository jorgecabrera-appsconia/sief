import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatDateDDMMYY } from "@/lib/utils";
import type { ExamSchedule } from "@shared/schema";

const formatDateForPDF = (dateStr: string) => formatDateDDMMYY(dateStr);

interface TeacherActaData {
  examSchedule: ExamSchedule;
  students: any[];
}

export function generateTeacherActaPDF(data: TeacherActaData) {
  const { examSchedule, students } = data;
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;

  // Encabezado institucional
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("INSTITUTO SUPERIOR DE FORMACIÓN DOCENTE", pageWidth / 2, 20, {
    align: "center",
  });
  doc.text('"DR. PEDRO IGNACIO DE CASTRO BARROS"', pageWidth / 2, 28, {
    align: "center",
  });

  // Título del acta
  doc.setFontSize(14);
  doc.text("ACTA VOLANTE DE EXÁMENES", pageWidth / 2, 38, { align: "center" });

  // Folio (alineado a la derecha)
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const folioX = pageWidth - 50;
  doc.text("Folio:", folioX, 45);
  doc.line(folioX + 18, 45, folioX + 42, 45);

  // Datos del examen
  const startY = 55;
  doc.text("Acta de Estudiantes:", 20, startY);
  doc.text(`Carrera: ${examSchedule.profesorado}`, 80, startY);
  doc.text(`Fecha: ${formatDateForPDF(examSchedule.date)}`, 160, startY);

  doc.text(`Espacio Curricular: ${examSchedule.subject}`, 20, startY + 8);
  doc.text(
    `Año: ${examSchedule.year}° Turno: ${examSchedule.turno.charAt(0).toUpperCase() + examSchedule.turno.slice(1)}`,
    160,
    startY + 8,
  );

  const totalAlumnos = students.length;

  // Crear filas de estudiantes confirmados + 5 filas vacías
  const studentRows = [
    ...students.map((student, index) => [
      (index + 1).toString(),
      `${student.lastName}, ${student.firstName}`,
      "",
      "",
      "",
      "",
      "",
      student.dni.toString(),
    ]),
    // 5 filas vacías para completar manualmente
    ...Array.from({ length: 5 }, (_, index) => [
      (students.length + index + 1).toString(),
      "",
      "",
      "",
      "",
      "",
      "",
      "",
    ]),
  ];

  // Tabla de estudiantes con estructura similar al acta original
  const tableY = startY + 20;
  autoTable(doc, {
    startY: tableY,
    head: [
      [
        "N°",
        "Apellido y Nombre",
        "1er llamado",
        "2do llamado",
        "Nota",
        "Letra",
        "Firma",
        "DNI",
      ],
    ],
    body: studentRows,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [200, 200, 200], textColor: [0, 0, 0] },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { halign: "left", cellWidth: 60 },
      2: { cellWidth: 15 },
      3: { cellWidth: 15 },
      4: { cellWidth: 15 },
      5: { cellWidth: 15 },
      6: { cellWidth: 15 },
      7: { cellWidth: 35 },
    },
    tableLineColor: [0, 0, 0],
    tableLineWidth: 0.5,
    margin: { left: 15, right: 15, bottom: 45 },
    pageBreak: "avoid",
  });

  // Final Y para pie de acta
  const finalY = (doc as any).lastAutoTable.finalY + 10;

  const tribunalData = [
    [
      "Presidente:",
      examSchedule.presidente,
      "Total de Alumnos:",
      totalAlumnos.toString(),
    ],
    ["Vocal:", examSchedule.vocal1, "Aprobados:", ""],
    ["Vocal:", examSchedule.vocal2, "Aplazados:", ""],
    ["", "", "Ausentes:", ""],
  ];

  autoTable(doc, {
    startY: finalY,
    body: tribunalData,
    theme: "grid",
    styles: { fontSize: 10 },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 25 },
      1: { cellWidth: 80 },
      2: { fontStyle: "bold", cellWidth: 35 },
      3: { cellWidth: 30 },
    },
    margin: { left: 15, right: 15 },
    tableLineColor: [0, 0, 0],
    tableLineWidth: 0.5,
    pageBreak: "avoid",
  });

  // Fecha final centrada
  doc.setFontSize(10);
  doc.text(
    "La Rioja, ...................... de ..................................... de 2026",
    pageWidth / 2,
    pageHeight - 15,
    { align: "center" },
  );

  // Agregar número de página discreto
  doc.setFontSize(8);
  doc.setTextColor(128, 128, 128); // Color gris
  doc.text(`Página 1`, pageWidth - 20, pageHeight - 5, { align: "right" });

  // Nombre de archivo
  const fileName = `Acta_Docente_${examSchedule.subject}_${examSchedule.year}año_${examSchedule.turno}_${examSchedule.date}.pdf`;
  doc.save(fileName);
}
