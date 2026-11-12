import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  AlignmentType,
  BorderStyle,
  WidthType,
  HeadingLevel,
} from "docx";
import { saveAs } from "file-saver";
import type { ExamSchedule, Inscription, Student } from "@shared/schema";

interface ActaVolanteData {
  examSchedule: ExamSchedule;
  inscriptions: Inscription[];
  students: Student[];
}

export async function generateActaVolanteDOCX(data: ActaVolanteData) {
  const { examSchedule, inscriptions, students } = data;

  // Calcular inscriptos confirmados
  const confirmedRows = inscriptions.filter(
    (inscription) => inscription.status === "confirmed",
  );

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
      return {
        number: (index + 1).toString(),
        name: `${student.lastName}, ${student.firstName}${conditionLabel}`,
        dni: student.dni.toString(),
      };
    })
    .filter((row) => row !== null);

  // Agregar filas vacías hasta 10 más
  const extraRows = 10;
  for (let i = 0; i < extraRows; i++) {
    studentRows.push({
      number: "",
      name: "",
      dni: "",
    });
  }

  // Crear el documento
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          // Encabezado institucional
          new Paragraph({
            children: [
              new TextRun({
                text: "INSTITUTO SUPERIOR DE FORMACIÓN DOCENTE",
                bold: true,
                size: 24,
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 120 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: '"DR. PEDRO IGNACIO DE CASTRO BARROS"',
                bold: true,
                size: 24,
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 240 },
          }),

          // Título del acta
          new Paragraph({
            children: [
              new TextRun({
                text: "ACTA VOLANTE DE EXÁMENES",
                bold: true,
                size: 28,
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 360 },
          }),

          // Folio (alineado a la derecha)
          new Paragraph({
            children: [
              new TextRun({
                text: "Folio: ___________",
                size: 20,
              }),
            ],
            alignment: AlignmentType.RIGHT,
            spacing: { after: 240 },
          }),

          // Información del examen
          new Paragraph({
            children: [
              new TextRun({
                text: `Acta de Estudiantes: _______________     Carrera: ${examSchedule.profesorado}     Fecha: ___/___/_____`,
                size: 20,
              }),
            ],
            spacing: { after: 160 },
          }),

          new Paragraph({
            children: [
              new TextRun({
                text: `Espacio Curricular: ${examSchedule.subject}     Año: ${examSchedule.year}° Turno: ${examSchedule.turno.charAt(0).toUpperCase() + examSchedule.turno.slice(1)}`,
                size: 20,
              }),
            ],
            spacing: { after: examSchedule.division ? 120 : 240 },
          }),

          // División si existe (alineado a la derecha como en el PDF)
          ...(examSchedule.division
            ? [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `División: ${examSchedule.division}`,
                      size: 18,
                    }),
                  ],
                  alignment: AlignmentType.RIGHT,
                  spacing: { after: 240 },
                }),
              ]
            : []),

          // Tabla de estudiantes - formato idéntico al PDF
          new Table({
            rows: [
              // Encabezados compuestos - primera fila
              new TableRow({
                children: [
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({ text: "N°", bold: true, size: 20 }),
                        ],
                        alignment: AlignmentType.CENTER,
                      }),
                    ],
                    rowSpan: 2,
                    width: { size: 6, type: WidthType.PERCENTAGE },
                  }),
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: "APELLIDO Y NOMBRE",
                            bold: true,
                            size: 20,
                          }),
                        ],
                        alignment: AlignmentType.CENTER,
                      }),
                    ],
                    rowSpan: 2,
                    width: { size: 35, type: WidthType.PERCENTAGE },
                  }),
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: "Calificaciones",
                            bold: true,
                            size: 20,
                          }),
                        ],
                        alignment: AlignmentType.CENTER,
                      }),
                    ],
                    columnSpan: 3,
                    width: { size: 30, type: WidthType.PERCENTAGE },
                  }),
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: "N° de Bol.",
                            bold: true,
                            size: 20,
                          }),
                        ],
                        alignment: AlignmentType.CENTER,
                      }),
                    ],
                    columnSpan: 2,
                    width: { size: 15, type: WidthType.PERCENTAGE },
                  }),
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: "Documento de Identidad",
                            bold: true,
                            size: 20,
                          }),
                        ],
                        alignment: AlignmentType.CENTER,
                      }),
                    ],
                    rowSpan: 2,
                    width: { size: 14, type: WidthType.PERCENTAGE },
                  }),
                ],
              }),
              // Segunda fila de encabezados
              new TableRow({
                children: [
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({ text: "Esc.", bold: true, size: 18 }),
                        ],
                        alignment: AlignmentType.CENTER,
                      }),
                    ],
                    width: { size: 10, type: WidthType.PERCENTAGE },
                  }),
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({ text: "Oral", bold: true, size: 18 }),
                        ],
                        alignment: AlignmentType.CENTER,
                      }),
                    ],
                    width: { size: 10, type: WidthType.PERCENTAGE },
                  }),
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({ text: "Prom.", bold: true, size: 18 }),
                        ],
                        alignment: AlignmentType.CENTER,
                      }),
                    ],
                    width: { size: 10, type: WidthType.PERCENTAGE },
                  }),
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({ text: "Esc.", bold: true, size: 18 }),
                        ],
                        alignment: AlignmentType.CENTER,
                      }),
                    ],
                    width: { size: 7, type: WidthType.PERCENTAGE },
                  }),
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({ text: "Oral", bold: true, size: 18 }),
                        ],
                        alignment: AlignmentType.CENTER,
                      }),
                    ],
                    width: { size: 8, type: WidthType.PERCENTAGE },
                  }),
                ],
              }),
              // Filas de estudiantes con formato idéntico al PDF
              ...studentRows.map(
                (row) =>
                  new TableRow({
                    children: [
                      new TableCell({
                        children: [
                          new Paragraph({
                            children: [
                              new TextRun({ text: row.number, size: 20 }),
                            ],
                            alignment: AlignmentType.CENTER,
                          }),
                        ],
                      }),
                      new TableCell({
                        children: [
                          new Paragraph({
                            children: [
                              new TextRun({ text: row.name, size: 20 }),
                            ],
                            alignment: AlignmentType.LEFT,
                          }),
                        ],
                      }),
                      new TableCell({
                        children: [
                          new Paragraph({
                            children: [new TextRun({ text: "", size: 20 })],
                          }),
                        ],
                      }),
                      new TableCell({
                        children: [
                          new Paragraph({
                            children: [new TextRun({ text: "", size: 20 })],
                          }),
                        ],
                      }),
                      new TableCell({
                        children: [
                          new Paragraph({
                            children: [new TextRun({ text: "", size: 20 })],
                          }),
                        ],
                      }),
                      new TableCell({
                        children: [
                          new Paragraph({
                            children: [new TextRun({ text: "", size: 20 })],
                          }),
                        ],
                      }),
                      new TableCell({
                        children: [
                          new Paragraph({
                            children: [new TextRun({ text: "", size: 20 })],
                          }),
                        ],
                      }),
                      new TableCell({
                        children: [
                          new Paragraph({
                            children: [
                              new TextRun({ text: row.dni, size: 20 }),
                            ],
                            alignment: AlignmentType.CENTER,
                          }),
                        ],
                      }),
                    ],
                  }),
              ),
            ],
            width: { size: 100, type: WidthType.PERCENTAGE },
          }),

          // Espaciado después de la tabla
          new Paragraph({
            children: [new TextRun({ text: "" })],
            spacing: { after: 240 },
          }),

          // Tabla de resumen estadístico (Total de Alumnos, Aprobados, Aplazados, Ausentes)
          new Table({
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: "Total de Alumnos:",
                            bold: true,
                            size: 20,
                          }),
                        ],
                        alignment: AlignmentType.LEFT,
                      }),
                    ],
                    width: { size: 25, type: WidthType.PERCENTAGE },
                  }),
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: confirmedRows.length.toString(),
                            size: 20,
                          }),
                        ],
                        alignment: AlignmentType.CENTER,
                      }),
                    ],
                    width: { size: 25, type: WidthType.PERCENTAGE },
                  }),
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [new TextRun({ text: "", size: 20 })],
                      }),
                    ],
                    width: { size: 50, type: WidthType.PERCENTAGE },
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: "Aprobados:",
                            bold: true,
                            size: 20,
                          }),
                        ],
                        alignment: AlignmentType.LEFT,
                      }),
                    ],
                  }),
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [new TextRun({ text: "", size: 20 })],
                        alignment: AlignmentType.CENTER,
                      }),
                    ],
                  }),
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [new TextRun({ text: "", size: 20 })],
                      }),
                    ],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: "Aplazados:",
                            bold: true,
                            size: 20,
                          }),
                        ],
                        alignment: AlignmentType.LEFT,
                      }),
                    ],
                  }),
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [new TextRun({ text: "", size: 20 })],
                        alignment: AlignmentType.CENTER,
                      }),
                    ],
                  }),
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [new TextRun({ text: "", size: 20 })],
                      }),
                    ],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: "Ausentes:",
                            bold: true,
                            size: 20,
                          }),
                        ],
                        alignment: AlignmentType.LEFT,
                      }),
                    ],
                  }),
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [new TextRun({ text: "", size: 20 })],
                        alignment: AlignmentType.CENTER,
                      }),
                    ],
                  }),
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [new TextRun({ text: "", size: 20 })],
                      }),
                    ],
                  }),
                ],
              }),
            ],
            width: { size: 50, type: WidthType.PERCENTAGE },
          }),

          // Espaciado después del resumen
          new Paragraph({
            children: [new TextRun({ text: "" })],
            spacing: { after: 240 },
          }),

          // Información del tribunal - formato idéntico al PDF
          new Paragraph({
            children: [
              new TextRun({
                text: `Presidente: ${examSchedule.presidente || "_".repeat(50)}`,
                size: 20,
              }),
              new TextRun({
                text: `                    Firma: ${"_".repeat(40)}`,
                size: 20,
              }),
            ],
            spacing: { after: 300 },
          }),

          new Paragraph({
            children: [
              new TextRun({
                text: `Vocal 1°: ${examSchedule.vocal1 || "_".repeat(50)}`,
                size: 20,
              }),
              new TextRun({
                text: `                      Firma: ${"_".repeat(40)}`,
                size: 20,
              }),
            ],
            spacing: { after: 300 },
          }),

          new Paragraph({
            children: [
              new TextRun({
                text: `Vocal 2°: ${examSchedule.vocal2 || "_".repeat(50)}`,
                size: 20,
              }),
              new TextRun({
                text: `                      Firma: ${"_".repeat(40)}`,
                size: 20,
              }),
            ],
            spacing: { after: 300 },
          }),

          new Paragraph({
            children: [
              new TextRun({
                text: `Vocal Suplente: ${examSchedule.vocalSuplente || "_".repeat(50)}`,
                size: 20,
              }),
              new TextRun({
                text: `           Firma: ${"_".repeat(40)}`,
                size: 20,
              }),
            ],
            spacing: { after: 480 },
          }),

          // Fecha final - formato idéntico al PDF
          new Paragraph({
            children: [
              new TextRun({
                text: "La Rioja, ...................... de ..................................... de 2026",
                size: 22,
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { before: 240 },
          }),
        ],
      },
    ],
  });

  // Generar y guardar el archivo
  const buffer = await Packer.toBlob(doc);
  const fileName = `Acta_Volante_${examSchedule.subject}_${examSchedule.year}año_${examSchedule.turno}_${examSchedule.date}.docx`;
  saveAs(buffer, fileName);
}
