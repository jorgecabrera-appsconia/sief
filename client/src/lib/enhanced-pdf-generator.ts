import jsPDF from 'jspdf';
import { formatDateDDMMYY } from '@/lib/utils';
import type { Student, ExamSchedule } from '@shared/schema';

const formatDateForPDF = (dateStr: string) => formatDateDDMMYY(dateStr);

interface EnhancedPDFData {
  student: Student;
  examSchedules: ExamSchedule[];
  isPending?: boolean;
  isPermissionSlip?: boolean;
  permissionNumber?: number;
}

/**
 * Generates institutional PDF documents with professional formatting
 * Supports both registration receipts and exam permission slips
 */
export function generateEnhancedPDF({ student, examSchedules, isPending = false, isPermissionSlip = false, permissionNumber }: EnhancedPDFData) {
  const doc = new jsPDF();
  
  // Page dimensions and margins
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - (margin * 2);
  
  let yPosition = margin;

  // Header with institutional design
  const drawHeader = () => {
    // Institution name
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('INSTITUTO SUPERIOR DE FORMACIÓN DOCENTE', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 8;
    
    doc.setFontSize(14);
    doc.text('"Dr. Pedro Ignacio de Castro Barros"', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 15;
    
    // Document title
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    const title = isPermissionSlip ? 'PERMISO DE EXAMEN' : 'COMPROBANTE DE INSCRIPCIÓN A MESAS DE EXAMEN';
    doc.text(title, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 15;
    
    // Permission number for permission slips
    if (isPermissionSlip && permissionNumber) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      const permissionNumberStr = String(permissionNumber).padStart(4, '0');
      doc.text(`Permiso de examen N°: ${permissionNumberStr}`, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 10;
    }
    
    // Horizontal line
    doc.setLineWidth(0.5);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 10;
  };

  // Student information section
  const drawStudentInfo = () => {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('DATOS DEL ALUMNO', margin, yPosition);
    yPosition += 8;
    
    // Create table-like layout for student data
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    
    const leftColumn = margin + 5;
    const rightColumn = pageWidth / 2 + 10;
    
    // Left column
    doc.text(`Apellido/s: ${student.lastName}`, leftColumn, yPosition);
    yPosition += 6;
    doc.text(`Nombre/s: ${student.firstName}`, leftColumn, yPosition);
    yPosition += 6;
    doc.text(`DNI N°: ${student.dni}`, leftColumn, yPosition);
    
    // Reset position for right column
    yPosition -= 12;
    doc.text(`Teléfono: ${student.phone}`, rightColumn, yPosition);
    yPosition += 6;
    doc.text(`Email: ${student.email}`, rightColumn, yPosition);
    yPosition += 6;
    
    // Academic info on new line
    yPosition += 8;
    const profesoradoLabels = {
      'educacion-inicial': 'Educación Inicial',
      'educacion-primaria': 'Educación Primaria',
      'biologia': 'Biología'
    };
    
    const turnoLabels = {
      'mañana': 'Mañana',
      'siesta': 'Siesta', 
      'tarde': 'Tarde'
    };
    
    doc.text(`Profesorado: ${profesoradoLabels[student.profesorado as keyof typeof profesoradoLabels] || student.profesorado}`, leftColumn, yPosition);
    doc.text(`Turno: ${turnoLabels[student.turno as keyof typeof turnoLabels] || student.turno}`, rightColumn, yPosition);
    yPosition += 6;
    doc.text(`Año: ${student.year}°`, leftColumn, yPosition);
    
    yPosition += 15;
  };

  // Exam schedules table
  const drawExamTable = () => {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('MATERIAS INSCRIPTAS', margin, yPosition);
    yPosition += 10;
    
    // Table headers
    const tableTop = yPosition;
    const rowHeight = 8;
    const colWidths = [60, 20, 30, 25, 40]; // Subject, Year, Date, Time, Teacher
    const colPositions = [
      margin,
      margin + colWidths[0],
      margin + colWidths[0] + colWidths[1],
      margin + colWidths[0] + colWidths[1] + colWidths[2],
      margin + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3]
    ];
    
    // Draw table border
    doc.rect(margin, tableTop - 3, contentWidth, (examSchedules.length + 1) * rowHeight + 6);
    
    // Headers
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('MATERIA', colPositions[0] + 2, yPosition);
    doc.text('AÑO', colPositions[1] + 2, yPosition);
    doc.text('FECHA', colPositions[2] + 2, yPosition);
    doc.text('HORA', colPositions[3] + 2, yPosition);
    doc.text('DOCENTE', colPositions[4] + 2, yPosition);
    
    // Header separator line
    yPosition += 3;
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 5;
    
    // Table rows
    doc.setFont('helvetica', 'normal');
    examSchedules.forEach((exam, index) => {
      // Vertical lines
      colPositions.forEach(pos => {
        doc.line(pos, tableTop - 3, pos, tableTop + (examSchedules.length + 1) * rowHeight + 3);
      });
      
      doc.text(exam.subject, colPositions[0] + 2, yPosition);
      doc.text(`${exam.year}°`, colPositions[1] + 2, yPosition);
      doc.text(formatDateForPDF(exam.date), colPositions[2] + 2, yPosition);
      doc.text(exam.time, colPositions[3] + 2, yPosition);
      doc.text(exam.teacher.substring(0, 15), colPositions[4] + 2, yPosition);
      
      yPosition += rowHeight;
    });
    
    // Final vertical line
    doc.line(pageWidth - margin, tableTop - 3, pageWidth - margin, tableTop + (examSchedules.length + 1) * rowHeight + 3);
    
    yPosition += 10;
  };

  // Mesa composition (for permission slips)
  const drawMesaInfo = () => {
    if (!isPermissionSlip) return;
    
    examSchedules.forEach((exam, index) => {
      if (yPosition > pageHeight - 50) {
        doc.addPage();
        yPosition = margin;
      }
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`MESA DE ${exam.subject.toUpperCase()}`, margin, yPosition);
      yPosition += 8;
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(`Presidente: ${exam.presidente}`, margin + 5, yPosition);
      yPosition += 5;
      doc.text(`Vocal 1°: ${exam.vocal1}`, margin + 5, yPosition);
      yPosition += 5;
      doc.text(`Vocal 2°: ${exam.vocal2}`, margin + 5, yPosition);
      yPosition += 5;
      doc.text(`Vocal Suplente: ${exam.vocalSuplente}`, margin + 5, yPosition);
      yPosition += 10;
      
      // Empty fields for permission slip
      doc.text('Calificación: ________________________', margin + 5, yPosition);
      yPosition += 8;
      doc.text('Observaciones: ________________________', margin + 5, yPosition);
      yPosition += 8;
      doc.text('________________________', margin + 5, yPosition);
      yPosition += 15;
    });
  };

  // Status message
  const drawStatusMessage = () => {
    if (isPending) {
      doc.setFillColor(255, 243, 205); // Light yellow
      doc.rect(margin, yPosition, contentWidth, 25, 'F');
      doc.setDrawColor(245, 158, 11); // Orange border
      doc.rect(margin, yPosition, contentWidth, 25);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('ESTADO: PENDIENTE DE APROBACIÓN', margin + 5, yPosition + 8);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text('Esta inscripción debe ser confirmada por la administración.', margin + 5, yPosition + 16);
      doc.text('Conserve este comprobante hasta recibir la confirmación oficial.', margin + 5, yPosition + 22);
      
      yPosition += 35;
    }
  };

  // Footer with important notes
  const drawFooter = () => {
    // Move to bottom section
    yPosition = Math.max(yPosition, pageHeight - 80);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('IMPORTANTE - REQUISITOS PARA RENDIR EXAMEN:', margin, yPosition);
    yPosition += 8;
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const requirements = [
      '• Tener condición de alumno regular en la asignatura en la que se inscribe.',
      '• Contar con la libreta firmada por el docente de la cátedra.',
      '• Haber aprobado las materias correlativas correspondientes.',
      '• Ante cualquier duda o consulta, comuníquese con su bedelía.'
    ];
    
    requirements.forEach(req => {
      doc.text(req, margin + 5, yPosition);
      yPosition += 5;
    });
    
    yPosition += 10;
    
    // Date and signatures
    doc.setFontSize(8);
    doc.text(`Fecha de emisión: ${new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}`, margin, yPosition);
    
    if (isPermissionSlip) {
      yPosition += 15;
      doc.text('Firma del Presidente de Mesa: ________________________', margin, yPosition);
      yPosition += 8;
      doc.text('Sello de la Institución: ________________________', pageWidth - margin - 80, yPosition - 8);
    }
  };

  // Generate the document
  drawHeader();
  drawStudentInfo();
  drawExamTable();
  drawMesaInfo();
  drawStatusMessage();
  drawFooter();

  // Download the PDF
  const fileName = isPermissionSlip 
    ? `permiso_examen_${student.lastName}_${student.firstName}.pdf`
    : `inscripcion_${student.lastName}_${student.firstName}.pdf`;
  
  doc.save(fileName);
}

/**
 * Generates a permission slip PDF for approved exam registrations
 */
export function generatePermissionSlipPDF(student: Student, examSchedules: ExamSchedule[], permissionNumber?: number) {
  generateEnhancedPDF({
    student,
    examSchedules,
    isPending: false,
    isPermissionSlip: true,
    permissionNumber
  });
}