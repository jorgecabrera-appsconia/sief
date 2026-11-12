import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

interface ExportInscription {
  id: number;
  student: {
    firstName: string;
    lastName: string;
    dni: string;
    profesorado: string;
  };
  examSchedules: Array<{
    subject: string;
    year: number;
    date: string;
    time: string;
    teacher: string;
  }>;
  status: string;
  confirmedBy: string | null;
  confirmedAt: Date | null;
  createdAt: Date | null;
}

const profesoradoLabels: { [key: string]: string } = {
  "educacion-inicial": "Educación Inicial",
  "educacion-primaria": "Educación Primaria",
  "biologia": "Biología"
};

const statusLabels: { [key: string]: string } = {
  "pending": "Pendiente",
  "confirmed": "Confirmada",
  "rejected": "Rechazada"
};

export async function exportInscriptionsToExcel(inscriptions: ExportInscription[]) {
  if (!inscriptions || !Array.isArray(inscriptions)) {
    console.error('Invalid inscriptions data for Excel export');
    return;
  }

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Inscripciones');

  worksheet.columns = [
    { header: 'N°', key: 'num', width: 5 },
    { header: 'Apellido', key: 'apellido', width: 20 },
    { header: 'Nombre', key: 'nombre', width: 20 },
    { header: 'DNI', key: 'dni', width: 12 },
    { header: 'Profesorado', key: 'profesorado', width: 18 },
    { header: 'Materias Inscriptas', key: 'materias', width: 40 },
    { header: 'Estado', key: 'estado', width: 12 },
    { header: 'Confirmado Por', key: 'confirmadoPor', width: 15 },
    { header: 'Fecha Confirmación', key: 'fechaConfirmacion', width: 15 },
    { header: 'Fecha Inscripción', key: 'fechaInscripcion', width: 15 },
  ];

  inscriptions.forEach((inscription, index) => {
    const student = inscription.student || {} as ExportInscription['student'];
    const subjects = (inscription.examSchedules || []).map(exam =>
      `${exam.subject} (${exam.year}° Año) - ${exam.date} ${exam.time}hs - ${exam.teacher}`
    ).join('\n');

    worksheet.addRow({
      num: index + 1,
      apellido: student.lastName || 'N/A',
      nombre: student.firstName || 'N/A',
      dni: student.dni || 'N/A',
      profesorado: profesoradoLabels[student.profesorado] || student.profesorado || 'N/A',
      materias: subjects,
      estado: statusLabels[inscription.status] || inscription.status || 'N/A',
      confirmadoPor: inscription.confirmedBy || '',
      fechaConfirmacion: inscription.confirmedAt
        ? new Date(inscription.confirmedAt).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })
        : '',
      fechaInscripcion: inscription.createdAt
        ? new Date(inscription.createdAt).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })
        : '',
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const currentDate = new Date().toISOString().split('T')[0];
  const filename = `Inscripciones_Examenes_${currentDate}.xlsx`;
  saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename);
}
