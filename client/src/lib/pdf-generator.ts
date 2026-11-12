import jsPDF from "jspdf";
import { formatDateDDMMYY } from "@/lib/utils";
import type { ExamSchedule } from "@shared/schema";

interface StudentData {
  firstName: string;
  lastName: string;
  dni: string;
  profesorado: string;
}

interface PDFData {
  student: StudentData;
  examSchedules: ExamSchedule[];
}

export function generatePDF({ student, examSchedules }: PDFData) {
  const doc = new jsPDF();

  // Header
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text('ISFD "Dr. Pedro Ignacio de Castro Barros"', 105, 20, {
    align: "center",
  });

  doc.setFontSize(14);
  doc.text("Instituto Superior de Formación Docente", 105, 30, {
    align: "center",
  });

  doc.setFontSize(18);
  doc.text("SOLICITUD DE INSCRIPCIÓN DE EXAMEN", 105, 45, { align: "center" });

  // Student Information
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("DATOS DEL ESTUDIANTE:", 20, 65);

  doc.setFont("helvetica", "normal");
  doc.text(`Apellido/s: ${student.lastName}`, 20, 75);
  doc.text(`Nombre/s: ${student.firstName}`, 20, 85);
  doc.text(`DNI: ${student.dni}`, 20, 95);
  doc.text(`Profesorado: ${student.profesorado}`, 20, 105);

  // Exam Information
  doc.setFont("helvetica", "bold");
  doc.text("MATERIAS SELECCIONADAS:", 20, 125);

  doc.setFont("helvetica", "normal");
  let yPosition = 135;

  examSchedules.forEach((exam, index) => {
    doc.text(
      `${index + 1}. ${exam.subject} (${exam.year}° Año)`,
      25,
      yPosition,
    );
    doc.text(
      `   Fecha: ${formatDateDDMMYY(exam.date)} - Hora: ${exam.time}`,
      25,
      yPosition + 7,
    );
    doc.text(`   Presidente de mesa: ${exam.presidente || "-"}`, 25, yPosition + 14);
    yPosition += 25;
  });

  // Important Note
  yPosition += 10;
  doc.setFont("helvetica", "bold");
  doc.text("NOTA IMPORTANTE:", 20, yPosition);

  doc.setFont("helvetica", "normal");
  doc.text(
    "Recuerde que para poder rendir debe tener la libreta firmada por el",
    20,
    yPosition + 10,
  );
  doc.text(
    "docente y haber aprobado las materias correlativas de la materia a rendir.",
    20,
    yPosition + 20,
  );
  doc.text(
    "Por favor presentar libreta al retirar el permiso de exámen y abonar el mismo.",
    20,
    yPosition + 20,
  );

  // Footer
  const currentDate = new Date().toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
  doc.text(`Fecha de inscripción: ${currentDate}`, 20, 270);

  doc.setFontSize(10);
  doc.text(
    "Este documento es válido únicamente para la inscripción a exámenes.",
    105,
    285,
    { align: "center" },
  );

  // Download PDF
  const fileName = `Solicitud_Inscripcion_${student.dni}_${currentDate.replace(/\//g, "-")}.pdf`;
  doc.save(fileName);
}
