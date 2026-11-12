import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { generatePDF } from "@/lib/pdf-generator";
import { User, Book, FileText, Info } from "lucide-react";
import type { ExamSchedule } from "@shared/schema";

const formSchema = z.object({
  firstName: z.string().min(1, "El nombre es requerido"),
  lastName: z.string().min(1, "El apellido es requerido"),
  dni: z.string().regex(/^\d{7,8}$/, "El DNI debe tener 7 u 8 dígitos"),
  profesorado: z.string().min(1, "Debe seleccionar un profesorado"),
  selectedSubjects: z
    .array(z.string())
    .min(1, "Debe seleccionar al menos una materia"),
  acceptTerms: z
    .boolean()
    .refine((val) => val === true, "Debe aceptar los términos y condiciones"),
});

type FormData = z.infer<typeof formSchema>;

const profesoradoOptions = [
  { value: "educacion-inicial", label: "Educación Inicial" },
  { value: "educacion-primaria", label: "Educación Primaria" },
  { value: "biologia", label: "Biología" },
];

export default function StudentForm() {
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      dni: "",
      profesorado: "",
      selectedSubjects: [],
      acceptTerms: false,
    },
  });

  // Fetch exam schedules
  const { data: examSchedules = [], isLoading } = useQuery<ExamSchedule[]>({
    queryKey: ["/api/exam-schedules"],
  });

  // Filter schedules by selected profesorado
  const profesorado = form.watch("profesorado");
  const filteredSchedules = examSchedules.filter(
    (schedule) => !profesorado || schedule.profesorado === profesorado,
  );

  // Group schedules by year
  const schedulesByYear = filteredSchedules.reduce(
    (acc, schedule) => {
      const year = schedule.year;
      if (!acc[year]) {
        acc[year] = [];
      }
      acc[year].push(schedule);
      return acc;
    },
    {} as Record<number, ExamSchedule[]>,
  );

  const createStudentMutation = useMutation({
    mutationFn: async (studentData: any) => {
      const response = await apiRequest("POST", "/api/students", studentData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/students"] });
    },
  });

  const createInscriptionMutation = useMutation({
    mutationFn: async (inscriptionData: any) => {
      const response = await apiRequest(
        "POST",
        "/api/inscriptions",
        inscriptionData,
      );
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inscriptions"] });
    },
  });

  const onSubmit = async (data: FormData) => {
    try {
      // Create student
      const student = await createStudentMutation.mutateAsync({
        firstName: data.firstName,
        lastName: data.lastName,
        dni: data.dni,
        profesorado: data.profesorado,
      });

      // Create inscription
      await createInscriptionMutation.mutateAsync({
        studentId: student.id,
        examScheduleIds: data.selectedSubjects,
        status: "pending",
      });

      // Get selected exam details for PDF
      const selectedExams = examSchedules.filter((exam) =>
        data.selectedSubjects.includes(exam.id.toString()),
      );

      // Generate PDF
      generatePDF({
        student: {
          firstName: data.firstName,
          lastName: data.lastName,
          dni: data.dni,
          profesorado:
            profesoradoOptions.find((p) => p.value === data.profesorado)
              ?.label || data.profesorado,
        },
        examSchedules: selectedExams,
      });

      toast({
        title: "Solicitud enviada",
        description:
          "Su solicitud de inscripción ha sido enviada y está pendiente de confirmación administrativa. El PDF se está descargando.",
      });

      // Reset form
      form.reset();
      setSelectedSubjects([]);
    } catch (error: any) {
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
    }
  };

  const handleSubjectChange = (examId: string, checked: boolean) => {
    let newSelected: string[];
    if (checked) {
      newSelected = [...selectedSubjects, examId];
    } else {
      newSelected = selectedSubjects.filter((id) => id !== examId);
    }
    setSelectedSubjects(newSelected);
    form.setValue("selectedSubjects", newSelected);
  };

  const getSelectedExamDetails = () => {
    return examSchedules.filter((exam) =>
      selectedSubjects.includes(exam.id.toString()),
    );
  };

  if (isLoading) {
    return (
      <div className="text-center py-8">Cargando materias disponibles...</div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Personal Information */}
        <div>
          <h5 className="text-lg font-medium text-primary mb-4 flex items-center">
            <User className="w-5 h-5 mr-2" />
            Información Personal
          </h5>
          <div className="grid md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="lastName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Apellido/s Completo *</FormLabel>
                  <FormControl>
                    <Input {...field} />
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
                  <FormLabel>Nombre/s Completo *</FormLabel>
                  <FormControl>
                    <Input {...field} />
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
                  <FormLabel>DNI Nº *</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="12345678" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="profesorado"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Profesorado *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione un profesorado" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {profesoradoOptions.map((option) => (
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
        </div>

        {/* Subject Selection */}
        <div>
          <h5 className="text-lg font-medium text-primary mb-4 flex items-center">
            <Book className="w-5 h-5 mr-2" />
            Selección de Materias
          </h5>
          <p className="text-muted-foreground mb-4">
            Seleccione las materias en las que desea inscribirse. Puede
            seleccionar múltiples materias de diferentes años.
          </p>

          {!profesorado ? (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Primero debe seleccionar un profesorado para ver las materias
                disponibles.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="border rounded-lg p-4 max-h-80 overflow-y-auto">
              {Object.keys(schedulesByYear).length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  No hay materias disponibles para el profesorado seleccionado.
                </p>
              ) : (
                <div className="grid md:grid-cols-2 gap-6">
                  {Object.entries(schedulesByYear)
                    .sort(([a], [b]) => parseInt(a) - parseInt(b))
                    .map(([year, schedules]) => (
                      <div key={year}>
                        <h6 className="font-medium text-primary mb-3">
                          {year}° Año
                        </h6>
                        <div className="space-y-3">
                          {schedules.map((schedule) => (
                            <div
                              key={schedule.id}
                              className="flex items-start space-x-2"
                            >
                              <Checkbox
                                id={`schedule-${schedule.id}`}
                                checked={selectedSubjects.includes(
                                  schedule.id.toString(),
                                )}
                                onCheckedChange={(checked) =>
                                  handleSubjectChange(
                                    schedule.id.toString(),
                                    !!checked,
                                  )
                                }
                              />
                              <div className="flex-1">
                                <Label
                                  htmlFor={`schedule-${schedule.id}`}
                                  className="font-medium cursor-pointer"
                                >
                                  {schedule.subject}
                                </Label>
                                <p className="text-sm text-muted-foreground">
                                  Mesa: {schedule.date} - {schedule.time}hs -{" "}
                                  {schedule.teacher}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* Selected Subjects Summary */}
          {selectedSubjects.length > 0 && (
            <Card className="mt-4 bg-blue-50">
              <CardContent className="p-4">
                <h6 className="font-medium text-primary mb-2">
                  Materias Seleccionadas:
                </h6>
                <ul className="space-y-1">
                  {getSelectedExamDetails().map((exam) => (
                    <li key={exam.id} className="text-sm">
                      {exam.year}° Año - {exam.subject} ({exam.date} -{" "}
                      {exam.time}hs)
                    </li>
                  ))}
                </ul>
                <p className="text-sm text-muted-foreground mt-2">
                  <strong>Total de materias seleccionadas:</strong>{" "}
                  {selectedSubjects.length}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Important Information */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <h6 className="font-medium mb-2">Información Importante</h6>
            <p className="mb-2">Recuerde que para poder rendir debe:</p>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>Tener la libreta firmada por el docente</li>
              <li>
                Haber aprobado las materias correlativas de la materia a rendir
              </li>
              <li>Presentarse con DNI en fecha y horario indicados</li>
            </ul>
          </AlertDescription>
        </Alert>

        {/* Terms and Conditions */}
        <FormField
          control={form.control}
          name="acceptTerms"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>
                  Declaro que la información proporcionada es correcta y acepto
                  los términos y condiciones *
                </FormLabel>
                <FormMessage />
              </div>
            </FormItem>
          )}
        />

        {/* Submit Button */}
        <div className="text-center">
          <Button
            type="submit"
            size="lg"
            className="px-8"
            disabled={
              createStudentMutation.isPending ||
              createInscriptionMutation.isPending
            }
          >
            <FileText className="w-4 h-4 mr-2" />
            {createStudentMutation.isPending ||
            createInscriptionMutation.isPending
              ? "Procesando..."
              : "Generar Solicitud de Inscripción"}
          </Button>
          <p className="text-sm text-muted-foreground mt-2">
            Se generará un PDF con su solicitud de inscripción
          </p>
        </div>
      </form>
    </Form>
  );
}
