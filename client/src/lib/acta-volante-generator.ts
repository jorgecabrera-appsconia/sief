import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { ExamSchedule, Inscription, Student } from "@shared/schema";

interface ActaVolanteData {
  examSchedule: ExamSchedule;
  inscriptions: Inscription[];
  students: Student[];
}

export function generateActaVolantePDF(data: ActaVolanteData) {
  const { examSchedule, inscriptions, students } = data;
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
  doc.text("Fecha:      /      /         ", 160, startY);
  //doc.text(`Fecha: ${new Date(examSchedule.date).toLocaleDateString("es-AR")}`, 160, startY,);

  doc.text(`Espacio Curricular: ${examSchedule.subject}`, 20, startY + 8);
  doc.text(
    `Año: ${examSchedule.year}° Turno: ${examSchedule.turno.charAt(0).toUpperCase() + examSchedule.turno.slice(1)}`,
    160,
    startY + 8,
  );

  // División agregada de manera discreta
  if (examSchedule.division) {
    doc.setFontSize(9);
    doc.text(`División: ${examSchedule.division}`, 160, startY + 16);
    doc.setFontSize(10); // Restaurar tamaño original
  }

  // Calcular inscriptos confirmados
  const confirmedRows = inscriptions.filter(
    (inscription) => inscription.status === "confirmed",
  );
  const totalAlumnos = confirmedRows.length;

  // Filas de estudiantes confirmados
  const studentRows = confirmedRows
    .map((inscription, index) => {
      const student = students.find((s) => s.id === inscription.studentId);
      if (!student) return null;
      // Add condition indicator (L) for "libre" students
      const inscriptionWithCondition = inscription as Inscription & {
        conditionForSubject?: string;
      };
      const conditionLabel =
        inscriptionWithCondition.conditionForSubject === "libre" ? " (L)" : "";
      return [
        (index + 1).toString(),
        `${student.lastName}, ${student.firstName}${conditionLabel}`,
        "",
        "",
        "",
        "",
        "",
        student.dni.toString(),
      ];
    })
    .filter((row) => row !== null);

  // Agregar filas vacías hasta 10 más
  const extraRows = 5;
  for (let i = 0; i < extraRows; i++) {
    studentRows.push(["", "", "", "", "", "", "", ""]);
  }

  // Encabezados compuestos
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

  // Tabla de estudiantes
  // Ajustar startY para acomodar la división si existe
  const tableStartY = examSchedule.division ? startY + 26 : startY + 18;
  autoTable(doc, {
    startY: tableStartY,
    head: tableHead,
    body: studentRows,
    styles: {
      fontSize: 10,
      cellPadding: 2,
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: "bold",
      halign: "center",
    },
    bodyStyles: {
      halign: "center",
    },
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
    theme: "grid",
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
  const fileName = `Acta_Volante_${examSchedule.subject}_${examSchedule.year}año_${examSchedule.turno}_${examSchedule.date}.pdf`;
  doc.save(fileName);
}
