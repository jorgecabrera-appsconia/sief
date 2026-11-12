import React, { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { generatePDF } from "@/lib/pdf-generator";
import { User, GraduationCap, FileText, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import type { ExamSchedule } from "@shared/schema";

// Enhanced form schema with separated sections
const enhancedFormSchema = z.object({
  // Personal Data
  lastName: z.string().min(1, "Los apellidos son requeridos"),
  firstName: z.string().min(1, "Los nombres son requeridos"),
  dni: z.string().min(7, "El DNI debe tener al menos 7 dígitos").max(8, "El DNI no puede tener más de 8 dígitos"),
  phone: z.string().min(10, "El teléfono debe tener al menos 10 dígitos"),
  email: z.string().email("Debe ser un email válido"),
  
  // Academic Data
  profesorado: z.string().min(1, "El profesorado es requerido"),
  turno: z.string().min(1, "El turno es requerido"),
  division: z.string().min(1, "La división es requerida"),
  year: z.number().min(1).max(4),
  yearEntered: z.number().min(2000).max(2025),
  
  // Exam Selection
  selectedExams: z.array(z.string()).min(1, "Debe seleccionar al menos una materia")
});

type EnhancedFormData = z.infer<typeof enhancedFormSchema>;

const profesoradoOptions = [
  { value: "Educación Inicial", label: "Educación Inicial" },
  { value: "Educación Primaria", label: "Educación Primaria" },
  { value: "Biología", label: "Biología" }
];

const turnoOptions = [
  { value: "mañana", label: "Mañana" },
  { value: "siesta", label: "Siesta" },
  { value: "tarde", label: "Tarde" }
];

const divisionOptions = [
  { value: "A", label: "A" },
  { value: "B", label: "B" },
  { value: "C", label: "C" },
  { value: "D", label: "D" }
];

/**
 * Enhanced student registration form with institutional design
 * Separated into personal data and academic data sections
 */
export default function EnhancedStudentForm() {
  const [step, setStep] = useState(1);
  const [selectedProfesorado, setSelectedProfesorado] = useState("");
  const [selectedTurno, setSelectedTurno] = useState("");
  const [selectedDivision, setSelectedDivision] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
      division: "",
      year: 1,
      yearEntered: 2025,
      selectedExams: [],
    },
  });

  // Fetch only open exam schedules (registration is open)
  // December 2025 only - force cache invalidation with version key
  const { data: allExamSchedules = [] } = useQuery<ExamSchedule[]>({
    queryKey: ["/api/exam-schedules/open", "december-2025-v2"],
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    staleTime: 0,
    gcTime: 0,
  });

  // Filter available exams based on selected profesorado, turno, and division
  // Show exams for years 1-4 that match all three criteria
  const availableExams = useMemo(() => {
    if (!selectedProfesorado || !selectedTurno || !selectedDivision) return [];
    return allExamSchedules.filter((exam: ExamSchedule) => 
      exam.profesorado === selectedProfesorado && 
      exam.turno === selectedTurno && 
      exam.division === selectedDivision &&
      exam.registrationOpen &&
      exam.year >= 1 && exam.year <= 4
    );
  }, [selectedProfesorado, selectedTurno, selectedDivision, allExamSchedules]);

  // Group exams by year for better organization
  const examsByYear = useMemo(() => {
    const grouped: { [key: number]: ExamSchedule[] } = { 1: [], 2: [], 3: [], 4: [] };
    availableExams.forEach((exam: ExamSchedule) => {
      if (exam.year >= 1 && exam.year <= 4) {
        grouped[exam.year].push(exam);
      }
    });
    return grouped;
  }, [availableExams]);

  const submitMutation = useMutation({
    mutationFn: async (data: EnhancedFormData) => {
      // Create student
      const studentData = {
        firstName: data.firstName,
        lastName: data.lastName,
        dni: data.dni,
        phone: data.phone,
        email: data.email,
        profesorado: data.profesorado,
        turno: data.turno,
        division: data.division,
        year: data.year,
        yearEntered: data.yearEntered,
      };

      const studentResponse = await apiRequest("POST", "/api/students", studentData);
      const student = await studentResponse.json();

      // Create inscription
      const inscriptionData = {
        studentId: student.id,
        examScheduleIds: data.selectedExams,
      };

      const inscriptionResponse = await apiRequest("POST", "/api/inscriptions", inscriptionData);
      const inscription = await inscriptionResponse.json();

      return { student, inscription };
    },
    onSuccess: (data) => {
      // Generate PDF with pending status message
      const selectedExamSchedules = availableExams.filter((exam: ExamSchedule) => 
        form.getValues("selectedExams").includes(exam.id.toString())
      );
      
      generatePDF({
        student: data.student,
        examSchedules: selectedExamSchedules
      });

      queryClient.invalidateQueries({ queryKey: ["/api/students"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inscriptions"] });
      
      toast({
        title: "Inscripción enviada",
        description: "Su solicitud está pendiente de aprobación administrativa. Se ha descargado su comprobante.",
      });

      form.reset();
      setStep(1);
    },
    onError: (error: any) => {
      let errorMessage = "Error al procesar la inscripción";
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

  const onSubmit = (data: EnhancedFormData) => {
    submitMutation.mutate(data);
  };

  const nextStep = () => {
    // Validate current step before proceeding
    if (step === 1) {
      form.trigger(["lastName", "firstName", "dni", "phone", "email"]).then(valid => {
        if (valid) setStep(2);
      });
    } else if (step === 2) {
      form.trigger(["profesorado", "turno", "division", "year"]).then(valid => {
        if (valid) setStep(3);
      });
    }
  };

  const prevStep = () => {
    setStep(step - 1);
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">
          Instituto Superior de Formación Docente
        </h1>
        <h2 className="text-lg sm:text-xl text-gray-700">
          "Dr. Pedro Ignacio de Castro Barros"
        </h2>
        <p className="text-base sm:text-lg font-semibold text-blue-600">
          Inscripción a Mesas de Exámenes
        </p>
      </div>

      {/* Progress Indicator - Mobile Responsive */}
      <div className="flex justify-center space-x-2 sm:space-x-4 mb-6 sm:mb-8">
        <div className={`flex flex-col sm:flex-row items-center space-y-1 sm:space-y-0 sm:space-x-2 ${step >= 1 ? 'text-blue-600' : 'text-gray-400'}`}>
          <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center ${step >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
            <User className="w-3 h-3 sm:w-4 sm:h-4" />
          </div>
          <span className="text-xs sm:text-sm font-medium text-center">Datos Personales</span>
        </div>
        <div className={`flex flex-col sm:flex-row items-center space-y-1 sm:space-y-0 sm:space-x-2 ${step >= 2 ? 'text-blue-600' : 'text-gray-400'}`}>
          <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center ${step >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
            <GraduationCap className="w-3 h-3 sm:w-4 sm:h-4" />
          </div>
          <span className="text-xs sm:text-sm font-medium text-center">Datos Académicos</span>
        </div>
        <div className={`flex flex-col sm:flex-row items-center space-y-1 sm:space-y-0 sm:space-x-2 ${step >= 3 ? 'text-blue-600' : 'text-gray-400'}`}>
          <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center ${step >= 3 ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
            <FileText className="w-3 h-3 sm:w-4 sm:h-4" />
          </div>
          <span className="text-xs sm:text-sm font-medium text-center">Mesas Diciembre</span>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Step 1: Personal Data */}
          {step === 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Datos Personales
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Apellido/s completos *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Ingrese sus apellidos" className="text-base sm:text-sm" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre/s completos *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Ingrese sus nombres" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="dni"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>DNI N° *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="12345678" type="number" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Número de teléfono *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="11 1234-5678" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>E-mail *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="ejemplo@email.com" type="email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end">
                  <Button type="button" onClick={nextStep} className="w-full sm:w-auto">
                    Continuar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 2: Academic Data */}
          {step === 2 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GraduationCap className="w-5 h-5" />
                  Datos Académicos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="profesorado"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Profesorado que cursa *</FormLabel>
                        <Select onValueChange={(value) => {
                          field.onChange(value);
                          setSelectedProfesorado(value);
                        }} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="text-base sm:text-sm">
                              <SelectValue placeholder="Seleccionar profesorado" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {profesoradoOptions.map(option => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="turno"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Turno *</FormLabel>
                        <Select onValueChange={(value) => {
                          field.onChange(value);
                          setSelectedTurno(value);
                        }} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="text-base sm:text-sm">
                              <SelectValue placeholder="Seleccionar turno" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {turnoOptions.map(option => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="division"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>División *</FormLabel>
                        <Select onValueChange={(value) => {
                          field.onChange(value);
                          setSelectedDivision(value);
                        }} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="text-base sm:text-sm">
                              <SelectValue placeholder="Seleccionar división" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {divisionOptions.map(option => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="year"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Año *</FormLabel>
                        <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value?.toString()}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar año" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="1">1° Año</SelectItem>
                            <SelectItem value="2">2° Año</SelectItem>
                            <SelectItem value="3">3° Año</SelectItem>
                            <SelectItem value="4">4° Año</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="yearEntered"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>¿En qué año ingresó al profesorado? *</FormLabel>
                        <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value?.toString()}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar año de ingreso" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Array.from({ length: 26 }, (_, i) => 2025 - i).map(year => (
                              <SelectItem key={year} value={year.toString()}>
                                {year}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="flex flex-col sm:flex-row justify-between gap-2 sm:gap-0">
                  <Button type="button" variant="outline" onClick={prevStep} className="w-full sm:w-auto">
                    <ChevronLeft className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                    Anterior
                  </Button>
                  <Button type="button" onClick={nextStep} className="w-full sm:w-auto">
                    Continuar
                    <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 ml-1 sm:ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 3: Exam Selection */}
          {step === 3 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Mesas de Examen Diciembre - Primer llamado
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {form.watch('profesorado') && form.watch('turno') && form.watch('division') ? (
                  <>
                    <div className="bg-blue-50 p-4 rounded-lg space-y-1">
                      <p className="text-sm text-blue-800">
                        <strong>Profesorado:</strong> {profesoradoOptions.find(p => p.value === form.watch('profesorado'))?.label}
                      </p>
                      <p className="text-sm text-blue-800">
                        <strong>Turno:</strong> {turnoOptions.find(t => t.value === form.watch('turno'))?.label}
                      </p>
                      <p className="text-sm text-blue-800">
                        <strong>División:</strong> {form.watch('division')}
                      </p>
                      <p className="text-xs text-blue-600 mt-2">
                        Se muestran todas las mesas de 1° a 4° año que coincidan con su profesorado, turno y división.
                      </p>
                    </div>

                    <FormField
                      control={form.control}
                      name="selectedExams"
                      render={() => (
                        <FormItem>
                          <FormLabel>Materias disponibles para inscripción *</FormLabel>
                          <div className="space-y-6">
                            {availableExams.length > 0 ? (
                              <>
                                {[1, 2, 3, 4].map((year) => {
                                  const yearExams = examsByYear[year] || [];
                                  if (yearExams.length === 0) return null;
                                  
                                  return (
                                    <div key={year} className="space-y-3">
                                      <h3 className="font-semibold text-lg border-b pb-2">
                                        {year}° Año - División {form.watch('division')}
                                      </h3>
                                      {yearExams.map((exam: ExamSchedule) => (
                                        <FormField
                                          key={exam.id}
                                          control={form.control}
                                          name="selectedExams"
                                          render={({ field }) => {
                                            return (
                                              <FormItem
                                                key={exam.id}
                                                className="flex flex-row items-start space-x-3 space-y-0 border rounded-lg p-4"
                                                data-testid={`exam-item-${exam.id}`}
                                              >
                                                <FormControl>
                                                  <Checkbox
                                                    data-testid={`checkbox-exam-${exam.id}`}
                                                    checked={field.value?.includes(exam.id.toString())}
                                                    onCheckedChange={(checked) => {
                                                      return checked
                                                        ? field.onChange([...field.value, exam.id.toString()])
                                                        : field.onChange(
                                                            field.value?.filter(
                                                              (value) => value !== exam.id.toString()
                                                            )
                                                          )
                                                    }}
                                                  />
                                                </FormControl>
                                                <div className="space-y-1 leading-none flex-1">
                                                  <FormLabel className="text-sm font-semibold">
                                                    {exam.subject}
                                                  </FormLabel>
                                                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                                                    <span>Fecha: {exam.date}</span>
                                                    <span>Hora: {exam.time}</span>
                                                    <span>Docente: {exam.teacher}</span>
                                                  </div>
                                                  <div className="text-xs text-muted-foreground">
                                                    <strong>Presidente:</strong> {exam.presidente}
                                                  </div>
                                                </div>
                                              </FormItem>
                                            )
                                          }}
                                        />
                                      ))}
                                    </div>
                                  );
                                })}
                              </>
                            ) : (
                              <div className="text-center py-8 text-muted-foreground">
                                <Clock className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                                <p>No hay materias disponibles para el profesorado, turno y división seleccionados.</p>
                                <p className="text-sm">Verifique los datos académicos o consulte con bedelía.</p>
                              </div>
                            )}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {availableExams.length > 0 && (
                      <div className="bg-yellow-50 p-4 rounded-lg">
                        <p className="text-sm text-yellow-800">
                          <strong>Importante:</strong> Su inscripción quedará en estado pendiente hasta ser 
                          confirmada por la administración. Recibirá un comprobante provisional que deberá 
                          presentar cuando su inscripción sea aprobada.
                        </p>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row justify-between gap-2 sm:gap-0">
                      <Button type="button" variant="outline" onClick={prevStep} className="w-full sm:w-auto">
                        <ChevronLeft className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                        Anterior
                      </Button>
                      <Button 
                        type="submit" 
                        disabled={submitMutation.isPending || availableExams.length === 0}
                        className="w-full sm:w-auto"
                      >
                        {submitMutation.isPending ? "Procesando..." : "Enviar Inscripción"}
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>Complete los datos académicos para ver las materias disponibles.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </form>
      </Form>
    </div>
  );
}