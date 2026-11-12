import jsPDF from "jspdf";
import { formatDateDDMMYY } from "@/lib/utils";
import type { Student, ExamSchedule } from "@shared/schema";
import selloImagePath from "@assets/sello_1753919777337.png";

export function generatePermissionSlipPDF(
  student: Student,
  examSchedules: ExamSchedule[],
  permissionNumber?: number,
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let y = 15;

  // Encabezado
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("INSTITUTO SUPERIOR DE FORMACIÓN DOCENTE", pageWidth / 2, y, {
    align: "center",
  });
  y += 7;
  doc.text('"Dr. Pedro Ignacio de Castro Barros"', pageWidth / 2, y, {
    align: "center",
  });
  y += 10;

  // Título
  doc.setFontSize(13);
  doc.text("PERMISO DE EXAMEN", pageWidth / 2, y, { align: "center" });
  y += 6;

  // Recuadro REGULARES y Permiso N°
  const boxWidth = 100;
  const boxX = (pageWidth - boxWidth) / 2;
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.rect(boxX, y, boxWidth, 16);
  doc.text("Para Alumnos:______________________", boxX + 2, y + 6);
  const permissionNumberStr = permissionNumber
    ? String(permissionNumber).padStart(4, "0")
    : "____";
  doc.text(`Permiso de examen N°: ${permissionNumberStr}`, boxX + 2, y + 13);
  y += 22;

  // Cuerpo introductorio
  const years = Array.from(new Set(examSchedules.map((e) => e.year)))
    .sort()
    .join(", ");
  const fullName = `${student.lastName}, ${student.firstName}`;
  const sentence = `Conste por la presente que el/la alumno/a: ${fullName} DNI N° ${student.dni}. Está habilitado para rendir las asignaturas correspondientes al: ${years}° Año de estudios, que indican a continuación, lo hizo en fecha señaladas.`;
  const split = doc.splitTextToSize(sentence, pageWidth - margin * 2);
  doc.text(split, margin, y);
  y += split.length * 6 + 4;

  // Tabla
  const headers = [
    "N°",
    "Espacios Curriculares / Disciplinas",
    "Fecha",
    "Calificación",
    "Firma del Pdte. de mesa",
  ];
  const colWidths = [10, 70, 25, 25, pageWidth - margin * 2 - 120];
  const rowHeight = 10;
  let x = margin;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  headers.forEach((header, i) => {
    doc.rect(x, y, colWidths[i], rowHeight);
    const textX = x + 1;
    const textY = y + 6;
    const lines = doc.splitTextToSize(header, colWidths[i] - 2);
    lines.forEach((line: string, idx: number) => {
      doc.text(line, textX, textY + idx * 4);
    });
    x += colWidths[i];
  });
  y += rowHeight;

  // Filas
  doc.setFont("helvetica", "normal");
  const sortedExams = [...examSchedules].sort((a, b) => {
    // Parse dates as YYYY-MM-DD directly to avoid timezone issues
    const aDateStr = a.date.replace(/-/g, ''); // Convert to YYYYMMDD for comparison
    const bDateStr = b.date.replace(/-/g, '');
    
    if (aDateStr !== bDateStr) {
      return aDateStr.localeCompare(bDateStr);
    }
    
    // If dates are equal, sort by time
    return a.time.localeCompare(b.time);
  });

  sortedExams.forEach((exam, index) => {
    x = margin;
    // Parse the date string correctly - assuming exam.date is in YYYY-MM-DD format from database
    let formattedDate = "";
    formattedDate = formatDateDDMMYY(exam.date);
    
    // Add condition indicator to subject name if "libre"
    const examWithCondition = exam as ExamSchedule & { condition?: string };
    const conditionLabel = examWithCondition.condition === "libre" ? " (L)" : "";
    const subjectWithCondition = exam.subject + conditionLabel;
    
    const values = [String(index + 1), subjectWithCondition, formattedDate, "", ""];
    values.forEach((text, i) => {
      doc.rect(x, y, colWidths[i], rowHeight);
      doc.text(text, x + 2, y + 6);
      x += colWidths[i];
    });
    y += rowHeight;
  });

  y += 12;

  // Fecha de emisión
  const today = new Date();
  const fechaEmision = `La Rioja, ${today.toLocaleDateString("es-AR", { day: '2-digit', month: '2-digit', year: '2-digit' })}`;
  doc.setFont("helvetica", "normal");
  doc.text(fechaEmision, margin, y);
  y += 25;

  // Sello institucional centrado (3cm de ancho = ~28.35mm)
  const selloWidth = 28.35; // 3cm en mm
  const selloHeight = selloWidth * 1.4; // Mantener proporción aproximada del sello oval
  const selloX = (pageWidth / 2) - (selloWidth / 2); // Centrado horizontalmente
  const selloY = y - 5;
  
  try {
    doc.addImage(selloImagePath, 'PNG', selloX, selloY, selloWidth, selloHeight);
  } catch (error) {
    // Fallback si la imagen no se puede cargar
    doc.text("Sello", pageWidth / 2, y + 15, { align: "center" });
  }
  
  y += 35;

  // Línea y firma del bedel
  doc.line(pageWidth - 80, y, pageWidth - 20, y);
  doc.text("(Firma del Bedel)", pageWidth - 80, y + 5);
  y += 15;

  // Nota
  doc.setFont("helvetica", "bold");
  doc.text("NOTA:", margin, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  const notaLines = [
    "1) Para poder rendir el examen, el alumno/a deberá presentar a la mesa examinadora este permiso,",
    "   la libreta de calificaciones completa y firmada por el docente, y su documento de identidad.",
    "2) Los exámenes escritos deben ser hechos con tinta.",
  ];
  notaLines.forEach((line) => {
    doc.text(line, margin, y);
    y += 5;
  });

  y += 6; // interlineado doble debajo de la nota

  // Código de permiso con contador
  const mes = String(today.getMonth() + 1).padStart(2, "0");
  const anio = String(today.getFullYear()).slice(-2);
  const letra =
    student.profesorado === "educacion-inicial"
      ? "I"
      : student.profesorado === "educacion-primaria"
        ? "P"
        : "B";
  const codPermiso = `01-${mes}${anio}${letra}${examSchedules[0]?.year || "?"}`;

  doc.setFontSize(8);
  doc.text(`Registro N°: ${codPermiso}`, pageWidth / 2, y, { align: "center" });

  // Guardar
  const fileName = `Permiso_Examen_${student.lastName}_${student.firstName}_${today.toISOString().split("T")[0]}.pdf`;
  doc.save(fileName);
}
