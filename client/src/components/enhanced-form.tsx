import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { formatDateDDMMYY } from "@/lib/utils";
import type { ExamSchedule, Subject, ExamCall } from "@shared/schema";
import CorrelativityAlert from "./correlativity-alert";

// Enhanced form schema with separated sections
const enhancedFormSchema = z.object({
  // Personal data
  lastName: z
    .string()
    .min(1, "Apellido es requerido")
    .transform((val) => val.toUpperCase()),
  firstName: z
    .string()
    .min(1, "Nombre es requerido")
    .transform((val) =>
      val
        .split(" ")
        .map(
          (name) => name.charAt(0).toUpperCase() + name.slice(1).toLowerCase(),
        )
        .join(" "),
    ),
  dni: z
    .string()
    .min(7, "DNI debe tener al menos 7 dígitos")
    .max(8, "DNI no puede tener más de 8 dígitos")
    .regex(/^\d+$/, "Inserte solo números"),
  phone: z.string().min(1, "Teléfono es requerido"),
  email: z.string().email("Email inválido"),

  // Academic data
  profesorado: z.string().min(1, "Profesorado es requerido"),
  turno: z.string().min(1, "Turno es requerido"),
  year: z.number().min(1).max(4),
  division: z.string().min(1, "División es requerida"),
  yearEntered: z.number().min(2000).max(2026),
  selectedExams: z
    .array(z.object({
      examId: z.number(),
      condition: z.enum(["regular", "libre"]).default("regular"),
    }))
    .min(1, "Debe seleccionar al menos un examen"),
});

type EnhancedFormData = z.infer<typeof enhancedFormSchema>;
type ExamSelection = { examId: number; condition: "regular" | "libre" };

/**
 * Enhanced student registration form with institutional design
 * Features multi-step interface and filtered exam selection
 */
export default function EnhancedForm() {
  const [step, setStep] = useState(1);
  const [pendingExam, setPendingExam] = useState<ExamSchedule | null>(null);
  const [showCorrelativityAlert, setShowCorrelativityAlert] = useState(false);
  const [prerequisites, setPrerequisites] = useState<Subject[]>([]);
  const [searchingDNI, setSearchingDNI] = useState(false);
  const [studentFound, setStudentFound] = useState(false);
  const [dniSearchValue, setDniSearchValue] = useState("");
  const [dniSearchPerformed, setDniSearchPerformed] = useState(false);
  const { toast } = useToast();

  const form = useForm<EnhancedFormData>({
    resolver: zodResolver(enhancedFormSchema),
    defaultValues: {
      lastName: "",
      firstName: "",
      dni: "",
      phone: "",
      email: "",
      profesorado: "",
      turno: "",
      year: 1,
      division: "",
      yearEntered: 2025,
      selectedExams: [],
    },
  });

  // Watch form values for filtering
  const profesorado = form.watch("profesorado");
  const turno = form.watch("turno");
  const division = form.watch("division");

  // Fetch active exam call
  const { data: activeExamCall } = useQuery<ExamCall | null>({
    queryKey: ["/api/exam-calls/active"],
  });

  // Fetch all exam schedules with open registration
  const { data: allExamSchedules = [] } = useQuery<ExamSchedule[]>({
    queryKey: ["/api/exam-schedules", { registrationOpen: "true" }],
    queryFn: async () => {
      const response = await fetch("/api/exam-schedules?registrationOpen=true");
      return response.json();
    },
  });

  // Filter exam schedules to those belonging to the active exam call.
  // Match by examCallId (same criterion the backend uses to validate inscriptions),
  // not by date range: other (inactive) calls can have open mesas whose dates overlap
  // the active call's period, and those must not leak into the registration form.
  const examSchedulesFromActiveCall = allExamSchedules.filter(exam => {
    if (!activeExamCall) return false;
    return exam.examCallId != null && exam.examCallId === activeExamCall.id;
  });

  // Function to search student by DNI
  const searchStudentByDNI = async () => {
    if (!dniSearchValue || dniSearchValue.length < 7) {
      toast({
        title: "DNI inválido",
        description: "Ingrese un DNI válido (7-8 dígitos)",
        variant: "destructive",
      });
      return;
    }

    setSearchingDNI(true);
    try {
      const response = await fetch(`/api/public/students/dni/${dniSearchValue}`);

      if (response.ok) {
        const result: { exists: boolean } = await response.json();
        setStudentFound(result.exists);
        form.setValue("dni", dniSearchValue);
        toast({
          title: result.exists ? "DNI registrado" : "DNI nuevo",
          description: result.exists
            ? "Complete sus datos. Para proteger su información, no mostramos datos guardados. El correo y teléfono deben coincidir con el registro existente."
            : "Complete sus datos para continuar con la inscripción.",
        });
      } else {
        throw new Error("No se pudo validar el DNI");
      }
      // Mark that search has been performed, regardless of result
      setDniSearchPerformed(true);
    } catch (error) {
      console.error("Error searching student:", error);
      toast({
        title: "Error",
        description: "Ocurrió un error al buscar el estudiante",
        variant: "destructive",
      });
    } finally {
      setSearchingDNI(false);
    }
  };

  // Filter available exams based on selected profesorado and turno only
  // Only show exams from the active exam call
  const availableExams = useMemo(() => {
    if (!profesorado || !turno) return [];

    // Filter by profesorado, turno, active exam call and registration status
    const filtered = examSchedulesFromActiveCall.filter(
      (exam) =>
        exam.profesorado === profesorado &&
        exam.turno === turno &&
        exam.registrationOpen === true,
    );

    // Remove duplicates based on subject, year, and division combination
    // Prioritize registration_open = true when there are duplicates
    const unique = filtered.reduce((acc: ExamSchedule[], exam) => {
      const existingIndex = acc.findIndex(
        (e) =>
          e.subject === exam.subject &&
          e.year === exam.year &&
          e.division === exam.division,
      );
      
      if (existingIndex === -1) {
        // No duplicate found, add it
        acc.push(exam);
      } else {
        // Duplicate found, keep the one with registration_open = true
        if (exam.registrationOpen && !acc[existingIndex].registrationOpen) {
          acc[existingIndex] = exam;
        }
      }
      
      return acc;
    }, []);

    // Sort by year first, then by subject alphabetically, then by division
    return unique.sort((a, b) => {
      // First sort by year (ascending)
      if (a.year !== b.year) {
        return a.year - b.year;
      }
      // Then sort by subject alphabetically
      if (a.subject !== b.subject) {
        return a.subject.localeCompare(b.subject);
      }
      // Finally sort by division
      return a.division.localeCompare(b.division);
    });
  }, [profesorado, turno, examSchedulesFromActiveCall]);

  const createInscriptionMutation = useMutation({
    mutationFn: async (data: EnhancedFormData) => {
      const response = await apiRequest(
        "POST",
        "/api/public/registrations",
        {
          student: {
            firstName: data.firstName,
            lastName: data.lastName,
            dni: data.dni,
            phone: data.phone,
            email: data.email,
            profesorado: data.profesorado,
            turno: data.turno,
            year: data.year,
            division: data.division,
            yearEntered: data.yearEntered,
          },
          examScheduleIds: data.selectedExams.map(e => String(e.examId)),
          examConditions: data.selectedExams.map(e => e.condition),
        },
      );
      const result = await response.json();
      return { ...result, selectedExams: data.selectedExams };
    },
    onSuccess: async (data) => {
      // Generate enhanced PDF with conditions
      const selectedExamSchedules = availableExams.filter((exam) =>
        data.selectedExams.some((e: ExamSelection) => e.examId === exam.id),
      ).map(exam => ({
        ...exam,
        condition: data.selectedExams.find((e: ExamSelection) => e.examId === exam.id)?.condition || "regular"
      }));

      const { generateEnhancedPDF } = await import(
        "@/lib/enhanced-pdf-generator"
      );
      generateEnhancedPDF({
        student: data.student,
        examSchedules: selectedExamSchedules,
        isPending: true,
      });

      toast({
        title: "Inscripción exitosa",
        description:
          "Su inscripción ha sido registrada y está pendiente de aprobación. Se ha generado su comprobante en PDF.",
      });

      // Reset form and states
      form.reset();
      setStep(1);
      setStudentFound(false);
      setDniSearchValue("");
    },
    onError: (error: any) => {
      let errorMessage = "Ocurrió un error al procesar la inscripción";
      try {
        const match = error.message?.match(/^\d+:\s*(.+)$/);
        if (match) {
          const parsed = JSON.parse(match[1]);
          errorMessage = parsed.message || errorMessage;
        }
      } catch {}
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const handleExamToggle = async (examId: number, condition: "regular" | "libre" = "regular") => {
    const currentSelected = form.getValues("selectedExams");
    const isSelected = currentSelected.some(e => e.examId === examId);

    if (isSelected) {
      // Remove exam
      form.setValue(
        "selectedExams",
        currentSelected.filter((e) => e.examId !== examId),
      );
    } else {
      // Check correlativities first
      const exam = availableExams.find((e) => e.id === examId);
      if (!exam) return;

      try {
        // Get subjects for this profesorado
        const subjectsResponse = await fetch(
          `/api/subjects?profesorado=${encodeURIComponent(exam.profesorado)}`,
        );
        const allSubjects: Subject[] = await subjectsResponse.json();

        // Find the subject that matches this exam
        const matchingSubject = allSubjects.find(
          (s) => s.name === exam.subject && s.profesorado === exam.profesorado,
        );

        if (matchingSubject) {
          // Get correlativities for this subject
          const correlativitiesResponse = await fetch(
            `/api/subjects/${matchingSubject.id}/correlativities`,
          );
          const correlativities: Subject[] =
            await correlativitiesResponse.json();

          if (correlativities.length > 0) {
            // Show correlativity alert
            setPendingExam(exam);
            setPrerequisites(correlativities);
            setShowCorrelativityAlert(true);
            return;
          }
        }

        // No correlativities, add exam directly with default condition
        form.setValue("selectedExams", [...currentSelected, { examId, condition: "regular" as const }]);
      } catch (error) {
        console.error("Error checking correlativities:", error);
        // If there's an error, add exam anyway
        form.setValue("selectedExams", [...currentSelected, { examId, condition: "regular" as const }]);
      }
    }
  };

  const handleCorrelativityApprove = () => {
    if (pendingExam) {
      const currentSelected = form.getValues("selectedExams");
      form.setValue("selectedExams", [...currentSelected, { examId: pendingExam.id, condition: "regular" as const }]);
    }
    setShowCorrelativityAlert(false);
    setPendingExam(null);
    setPrerequisites([]);
  };

  const handleCorrelativityCancel = () => {
    setShowCorrelativityAlert(false);
    setPendingExam(null);
    setPrerequisites([]);
  };

  const onSubmit = (data: EnhancedFormData) => {
    createInscriptionMutation.mutate(data);
  };

  const nextStep = () => {
    if (step === 1) {
      // Force validation of personal data fields
      const personalFields = [
        "lastName",
        "firstName",
        "dni",
        "phone",
        "email",
        "yearEntered",
      ] as const;

      // Trigger validation for all personal fields
      personalFields.forEach((field) => {
        form.trigger(field);
      });

      // Check if all personal fields have values and no errors
      const formValues = form.getValues();
      const hasEmptyFields = personalFields.some((field) => !formValues[field]);
      const hasErrors = personalFields.some(
        (field) => form.formState.errors[field],
      );

      if (hasEmptyFields || hasErrors) {
        toast({
          title: "Datos incompletos",
          description:
            "Por favor complete todos los campos de datos personales correctamente",
          variant: "destructive",
        });
        return;
      }

      setStep(2);
    } else if (step === 2) {
      // Validate academic data fields
      const academicFields = ["profesorado", "turno", "year"] as const;

      academicFields.forEach((field) => {
        form.trigger(field);
      });

      const formValues = form.getValues();
      const hasEmptyFields = academicFields.some((field) => !formValues[field]);
      const hasErrors = academicFields.some(
        (field) => form.formState.errors[field],
      );

      if (hasEmptyFields || hasErrors) {
        toast({
          title: "Datos académicos incompletos",
          description: "Por favor complete profesorado, turno y año",
          variant: "destructive",
        });
        return;
      }

      setStep(3);
    }
  };

  const prevStep = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="text-center text-blue-800">
          Formulario de Inscripción a Mesas de Examen
        </CardTitle>
        
        {/* Active Exam Call Indicator */}
        {activeExamCall && (
          <div className="mt-4 p-4 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-lg shadow-sm">
            <div className="text-center">
              <div className="text-sm font-medium text-green-700 uppercase tracking-wide">
                Inscripciones Abiertas
              </div>
              <div className="text-xl font-bold text-green-800 mt-1" data-testid="text-active-exam-call">
                {activeExamCall.name}
              </div>
              {activeExamCall.startDate && activeExamCall.endDate && (
                <div className="text-sm text-green-600 mt-1">
                  Período: {formatDateDDMMYY(activeExamCall.startDate)} al {formatDateDDMMYY(activeExamCall.endDate)}
                </div>
              )}
            </div>
          </div>
        )}
        
        {!activeExamCall && (
          <div className="mt-4 p-4 bg-yellow-50 border-2 border-yellow-300 rounded-lg">
            <div className="text-center text-yellow-800 font-medium">
              No hay un llamado de examen activo en este momento
            </div>
          </div>
        )}
        
        <div className="flex justify-center space-x-4 mt-4">
          {[1, 2, 3].map((stepNumber) => (
            <div
              key={stepNumber}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                step >= stepNumber
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 text-gray-600"
              }`}
            >
              {stepNumber}
            </div>
          ))}
        </div>
        <div className="text-center text-sm text-gray-600 mt-2">
          {step === 1 && "Datos Personales"}
          {step === 2 && "Datos Académicos"}
          {step === 3 && "Selección de Materias"}
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {step === 1 && (
            <div className="space-y-6">
              {/* DNI Search Floating Card */}
              <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-300 shadow-lg">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="bg-blue-600 rounded-full p-2">
                      <svg
                        className="w-6 h-6 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-blue-900 mb-1">
                        Búsqueda Rápida por DNI
                      </h3>
                      <p className="text-sm text-blue-700">
                        Ingresa tu DNI para comenzar. Por privacidad, los datos
                        personales guardados no se mostrarán.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Input
                      id="dniSearch"
                      data-testid="input-dni-search"
                      value={dniSearchValue}
                      placeholder="Ingrese su DNI (7-8 dígitos)"
                      onChange={(e) => {
                        const value = e.target.value
                          .replace(/\D/g, "")
                          .slice(0, 8);
                        setDniSearchValue(value);
                      }}
                      onKeyPress={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          searchStudentByDNI();
                        }
                      }}
                      className="flex-1 h-12 text-lg bg-white border-2 border-blue-300 focus:border-blue-500"
                      disabled={searchingDNI || dniSearchPerformed}
                    />
                    <Button
                      type="button"
                      onClick={searchStudentByDNI}
                      disabled={
                        searchingDNI || !dniSearchValue || dniSearchPerformed
                      }
                      data-testid="button-search-dni"
                      className="h-12 px-6 bg-blue-600 hover:bg-blue-700"
                    >
                      {searchingDNI ? (
                        <span className="flex items-center gap-2">
                          <svg
                            className="animate-spin h-5 w-5"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            ></circle>
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                          </svg>
                          Buscando...
                        </span>
                      ) : (
                        "Buscar DNI"
                      )}
                    </Button>
                  </div>

                  {studentFound && (
                    <div className="mt-3 p-3 bg-green-100 border border-green-300 rounded-lg flex items-center gap-2">
                      <svg
                        className="w-5 h-5 text-green-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <p className="text-green-700 font-medium text-sm">
                        DNI registrado. Complete todos los campos; el correo y
                        teléfono deben coincidir con los datos ya guardados.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {dniSearchPerformed && (
                <>
                  <h3 className="font-semibold text-lg">Datos Personales</h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="lastName">Apellido/s completos *</Label>
                      <Input
                        id="lastName"
                        data-testid="input-lastname"
                        {...form.register("lastName")}
                        className="mt-1"
                        onChange={(e) => {
                          const value = e.target.value.toUpperCase();
                          form.setValue("lastName", value);
                        }}
                      />
                      {form.formState.errors.lastName && (
                        <p className="text-red-500 text-sm mt-1">
                          {form.formState.errors.lastName.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="firstName">Nombre/s completos *</Label>
                      <Input
                        id="firstName"
                        data-testid="input-firstname"
                        {...form.register("firstName")}
                        className="mt-1"
                        onChange={(e) => {
                          const value = e.target.value
                            .split(" ")
                            .map(
                              (name) =>
                                name.charAt(0).toUpperCase() +
                                name.slice(1).toLowerCase(),
                            )
                            .join(" ");
                          form.setValue("firstName", value);
                        }}
                      />
                      {form.formState.errors.firstName && (
                        <p className="text-red-500 text-sm mt-1">
                          {form.formState.errors.firstName.message}
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="dni">DNI N° *</Label>
                    <Input
                      id="dni"
                      data-testid="input-dni"
                      {...form.register("dni")}
                      placeholder="Ej: 12345678 (solo números)"
                      className="mt-1"
                      onChange={(e) => {
                        // Remove non-digits and limit to 8 characters
                        const value = e.target.value
                          .replace(/\D/g, "")
                          .slice(0, 8);
                        form.setValue("dni", value);
                      }}
                      onKeyPress={(e) => {
                        // Prevent non-numeric characters
                        if (
                          !/\d/.test(e.key) &&
                          !["Backspace", "Delete", "Tab", "Enter"].includes(
                            e.key,
                          )
                        ) {
                          e.preventDefault();
                        }
                      }}
                    />
                    {form.formState.errors.dni && (
                      <p className="text-red-500 text-sm mt-1">
                        {form.formState.errors.dni.message}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="phone">Número de teléfono *</Label>
                      <Input
                        id="phone"
                        {...form.register("phone")}
                        placeholder="Ej: 3804123456"
                        className="mt-1"
                      />
                      {form.formState.errors.phone && (
                        <p className="text-red-500 text-sm mt-1">
                          {form.formState.errors.phone.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="email">E-mail *</Label>
                      <Input
                        id="email"
                        type="email"
                        {...form.register("email")}
                        placeholder="ejemplo@email.com"
                        className="mt-1"
                      />
                      {form.formState.errors.email && (
                        <p className="text-red-500 text-sm mt-1">
                          {form.formState.errors.email.message}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-between">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setDniSearchPerformed(false);
                        setStudentFound(false);
                        setDniSearchValue("");
                        form.reset({
                          lastName: "",
                          firstName: "",
                          dni: "",
                          phone: "",
                          email: "",
                          profesorado: "",
                          turno: "",
                          year: 1,
                          division: "",
                          yearEntered: 2025,
                          selectedExams: [],
                        });
                      }}
                    >
                      Cambiar DNI
                    </Button>
                    <Button type="button" onClick={nextStep}>
                      Siguiente
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg mb-4">Datos Académicos</h3>

              <div>
                <Label htmlFor="profesorado">Profesorado que cursa *</Label>
                <Select
                  value={profesorado}
                  onValueChange={(value) => form.setValue("profesorado", value)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Seleccione un profesorado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Educación Inicial">
                      Profesorado de Educación Inicial
                    </SelectItem>
                    <SelectItem value="Educación Primaria">
                      Profesorado de Educación Primaria
                    </SelectItem>
                    <SelectItem value="Biología">
                      Profesorado de Biología
                    </SelectItem>
                  </SelectContent>
                </Select>
                {form.formState.errors.profesorado && (
                  <p className="text-red-500 text-sm mt-1">
                    {form.formState.errors.profesorado.message}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="turno">Turno *</Label>
                  <Select
                    value={turno}
                    onValueChange={(value) => form.setValue("turno", value)}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Seleccione un turno" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mañana">Mañana</SelectItem>
                      <SelectItem value="siesta">Siesta</SelectItem>
                      <SelectItem value="tarde">Tarde</SelectItem>
                    </SelectContent>
                  </Select>
                  {form.formState.errors.turno && (
                    <p className="text-red-500 text-sm mt-1">
                      {form.formState.errors.turno.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="year">Año *</Label>
                  <Select
                    value={form.watch("year")?.toString()}
                    onValueChange={(value) =>
                      form.setValue("year", parseInt(value))
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Seleccione un año" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1ro</SelectItem>
                      <SelectItem value="2">2do</SelectItem>
                      <SelectItem value="3">3ro</SelectItem>
                      <SelectItem value="4">4to</SelectItem>
                    </SelectContent>
                  </Select>
                  {form.formState.errors.year && (
                    <p className="text-red-500 text-sm mt-1">
                      {form.formState.errors.year.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="division">División *</Label>
                  <Select
                    value={division}
                    onValueChange={(value) => form.setValue("division", value)}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Seleccione una división" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A">División A</SelectItem>
                      <SelectItem value="B">División B</SelectItem>
                      <SelectItem value="C">División C</SelectItem>
                      <SelectItem value="D">División D</SelectItem>
                    </SelectContent>
                  </Select>
                  {form.formState.errors.division && (
                    <p className="text-red-500 text-sm mt-1">
                      {form.formState.errors.division.message}
                    </p>
                  )}
                </div>

                <div></div>
              </div>

              <div>
                <Label htmlFor="yearEntered">
                  Año de ingreso al profesorado *
                </Label>
                <Select
                  value={form.watch("yearEntered")?.toString()}
                  onValueChange={(value) =>
                    form.setValue("yearEntered", parseInt(value))
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Año de ingreso" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 27 }, (_, i) => 2026 - i).map(
                      (year) => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
                {form.formState.errors.yearEntered && (
                  <p className="text-red-500 text-sm mt-1">
                    {form.formState.errors.yearEntered.message}
                  </p>
                )}
              </div>

              <div className="flex justify-between">
                <Button type="button" variant="outline" onClick={prevStep}>
                  Anterior
                </Button>
                <Button type="button" onClick={nextStep}>
                  Siguiente
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg mb-4">
                Selección de Materias
              </h3>

              {availableExams.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-600">
                    {!profesorado || !turno
                      ? "Seleccione profesorado y turno para ver las materias disponibles"
                      : "No hay materias disponibles para la combinación seleccionada"}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600 mb-4">
                    Seleccione las materias para las cuales desea inscribirse:
                  </p>

                  {availableExams.map((exam) => {
                    const selectedExam = form.watch("selectedExams").find(e => e.examId === exam.id);
                    const isSelected = !!selectedExam;
                    return (
                      <div
                        key={exam.id}
                        className="flex items-center space-x-3 p-3 border rounded"
                      >
                        <Checkbox
                          id={`exam-${exam.id}`}
                          checked={isSelected}
                          onCheckedChange={() => handleExamToggle(exam.id)}
                        />
                        <div className="flex-1">
                          <Label
                            htmlFor={`exam-${exam.id}`}
                            className="cursor-pointer font-medium"
                          >
                            {exam.subject} - {exam.year}° Año - División{" "}
                            {exam.division}
                          </Label>
                          <p className="text-sm text-gray-600">
                            Fecha: {formatDateDDMMYY(exam.date)} | Hora: {exam.time} | Prof:{" "}
                            {exam.teacher}
                          </p>
                          <p className="text-xs text-gray-500">
                            Mesa: {exam.presidente} (Presidente), {exam.vocal1},{" "}
                            {exam.vocal2}
                          </p>
                        </div>
                        {isSelected && (
                          <div className="flex items-center gap-2">
                            <Label className="text-sm">Condición:</Label>
                            <select
                              value={selectedExam?.condition || "regular"}
                              onChange={(e) => {
                                const newCondition = e.target.value as "regular" | "libre";
                                const currentSelected = form.getValues("selectedExams");
                                form.setValue("selectedExams", currentSelected.map(ex => 
                                  ex.examId === exam.id ? { ...ex, condition: newCondition } : ex
                                ));
                              }}
                              className="border rounded px-2 py-1 text-sm"
                            >
                              <option value="regular">Regular</option>
                              <option value="libre">Libre</option>
                            </select>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {form.formState.errors.selectedExams && (
                    <p className="text-red-500 text-sm mt-1">
                      {form.formState.errors.selectedExams.message}
                    </p>
                  )}
                </div>
              )}

              <div className="flex justify-between">
                <Button type="button" variant="outline" onClick={prevStep}>
                  Anterior
                </Button>
                <Button
                  type="submit"
                  disabled={
                    createInscriptionMutation.isPending ||
                    availableExams.length === 0
                  }
                >
                  {createInscriptionMutation.isPending
                    ? "Procesando..."
                    : "Enviar Inscripción"}
                </Button>
              </div>
            </div>
          )}
        </form>
      </CardContent>

      {/* Correlativity Alert */}
      {showCorrelativityAlert && pendingExam && (
        <CorrelativityAlert
          subject={pendingExam.subject}
          prerequisites={prerequisites}
          onCancel={handleCorrelativityCancel}
          onApprove={handleCorrelativityApprove}
        />
      )}
    </Card>
  );
}
