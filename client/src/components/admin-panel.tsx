import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { exportInscriptionsToExcel } from "@/lib/excel-export";
import { Calendar, Users, BarChart3, Plus, Edit, Trash2, Download, Check, X, Clock, Eye, EyeOff } from "lucide-react";
import type { ExamSchedule } from "@shared/schema";

const examFormSchema = z.object({
  subject: z.string().min(1, "La materia es requerida"),
  year: z.number().min(1).max(4),
  profesorado: z.string().min(1, "El profesorado es requerido"),
  teacher: z.string().min(1, "El docente es requerido"),
  date: z.string().min(1, "La fecha es requerida"),
  time: z.string().min(1, "La hora es requerida"),
});

type ExamFormData = z.infer<typeof examFormSchema>;

const profesoradoOptions = [
  { value: "educacion-inicial", label: "Educación Inicial" },
  { value: "educacion-primaria", label: "Educación Primaria" },
  { value: "biologia", label: "Biología" }
];

export default function AdminPanel() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<ExamSchedule | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<ExamFormData>({
    resolver: zodResolver(examFormSchema),
    defaultValues: {
      subject: "",
      year: 1,
      profesorado: "",
      teacher: "",
      date: "",
      time: "",
    },
  });

  // Queries
  const { data: examSchedules = [], isLoading: isExamSchedulesLoading } = useQuery<ExamSchedule[]>({
    queryKey: ["/api/exam-schedules"],
  });

  const { data: inscriptions = [], isLoading: isInscriptionsLoading } = useQuery<any[]>({
    queryKey: ["/api/inscriptions"],
  });

  const { data: statistics = {}, isLoading: isStatsLoading } = useQuery<any>({
    queryKey: ["/api/statistics"],
  });

  // Mutations
  const createExamMutation = useMutation({
    mutationFn: async (examData: ExamFormData) => {
      const response = await apiRequest("POST", "/api/exam-schedules", examData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exam-schedules"] });
      queryClient.invalidateQueries({ queryKey: ["/api/statistics"] });
      setIsAddModalOpen(false);
      form.reset();
      toast({
        title: "Mesa de examen creada",
        description: "La mesa de examen ha sido creada exitosamente.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error al crear la mesa de examen",
        variant: "destructive",
      });
    },
  });

  const updateExamMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: ExamFormData }) => {
      const response = await apiRequest("PUT", `/api/exam-schedules/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exam-schedules"] });
      setEditingExam(null);
      form.reset();
      toast({
        title: "Mesa de examen actualizada",
        description: "La mesa de examen ha sido actualizada exitosamente.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error al actualizar la mesa de examen",
        variant: "destructive",
      });
    },
  });

  const deleteExamMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/exam-schedules/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exam-schedules"] });
      queryClient.invalidateQueries({ queryKey: ["/api/statistics"] });
      toast({
        title: "Mesa de examen eliminada",
        description: "La mesa de examen ha sido eliminada exitosamente.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error al eliminar la mesa de examen",
        variant: "destructive",
      });
    },
  });

  const toggleVisibilityMutation = useMutation({
    mutationFn: async ({ id, registrationOpen }: { id: number; registrationOpen: boolean }) => {
      const response = await apiRequest("PATCH", `/api/exam-schedules/${id}`, { registrationOpen });
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/exam-schedules"] });
      toast({
        title: variables.registrationOpen ? "Mesa visible" : "Mesa oculta",
        description: variables.registrationOpen 
          ? "La mesa de examen ahora es visible en el formulario de inscripción." 
          : "La mesa de examen está oculta en el formulario de inscripción.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error al actualizar la visibilidad",
        variant: "destructive",
      });
    },
  });

  const updateInscriptionStatusMutation = useMutation({
    mutationFn: async ({ id, status, confirmedBy }: { id: number; status: string; confirmedBy?: string }) => {
      const response = await apiRequest("PUT", `/api/inscriptions/${id}/status`, { status, confirmedBy });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/statistics"] });
      toast({
        title: "Estado actualizado",
        description: "El estado de la inscripción ha sido actualizado exitosamente.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error al actualizar el estado de la inscripción",
        variant: "destructive",
      });
    },
  });

  const exportMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("GET", "/api/inscriptions/export");
      return response.json();
    },
    onSuccess: async (data) => {
      await exportInscriptionsToExcel(data);
      toast({
        title: "Exportación exitosa",
        description: "El archivo Excel se ha descargado correctamente.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error al exportar los datos",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ExamFormData) => {
    if (editingExam) {
      updateExamMutation.mutate({ id: editingExam.id, data });
    } else {
      createExamMutation.mutate(data);
    }
  };

  const handleEdit = (exam: ExamSchedule) => {
    setEditingExam(exam);
    form.reset({
      subject: exam.subject,
      year: exam.year,
      profesorado: exam.profesorado,
      teacher: exam.teacher,
      date: exam.date,
      time: exam.time,
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("¿Está seguro de que desea eliminar esta mesa de examen?")) {
      deleteExamMutation.mutate(id);
    }
  };

  const handleToggleVisibility = (exam: ExamSchedule) => {
    toggleVisibilityMutation.mutate({ 
      id: exam.id, 
      registrationOpen: !exam.registrationOpen 
    });
  };

  const openAddModal = () => {
    setEditingExam(null);
    form.reset();
    setIsAddModalOpen(true);
  };

  const getEnrolledCount = (examId: number) => {
    return inscriptions.filter((inscription: any) => 
      inscription.examScheduleIds?.includes(examId.toString())
    ).length;
  };

  const handleStatusUpdate = (inscriptionId: number, status: string) => {
    const confirmedBy = status === "confirmed" ? "Administrador" : undefined;
    updateInscriptionStatusMutation.mutate({ id: inscriptionId, status, confirmedBy });
  };

  const handleExportExcel = () => {
    exportMutation.mutate();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "confirmed":
        return <Badge variant="default" className="bg-green-100 text-green-800"><Check className="w-3 h-3 mr-1" />Confirmada</Badge>;
      case "rejected":
        return <Badge variant="destructive"><X className="w-3 h-3 mr-1" />Rechazada</Badge>;
      default:
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Pendiente</Badge>;
    }
  };

  return (
    <Tabs defaultValue="exam-schedules" className="space-y-6">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="exam-schedules" className="flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          Mesas de Examen
        </TabsTrigger>
        <TabsTrigger value="inscriptions" className="flex items-center gap-2">
          <Users className="w-4 h-4" />
          Inscripciones
        </TabsTrigger>
        <TabsTrigger value="reports" className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4" />
          Reportes
        </TabsTrigger>
      </TabsList>

      {/* Exam Schedules Tab */}
      <TabsContent value="exam-schedules" className="space-y-4">
        <div className="flex justify-between items-center">
          <h5 className="text-lg font-medium">Gestión de Mesas de Examen</h5>
          <Dialog open={isAddModalOpen || !!editingExam} onOpenChange={(open) => {
            if (!open) {
              setIsAddModalOpen(false);
              setEditingExam(null);
              form.reset();
            }
          }}>
            <DialogTrigger asChild>
              <Button onClick={openAddModal}>
                <Plus className="w-4 h-4 mr-2" />
                Nueva Mesa
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingExam ? "Editar Mesa de Examen" : "Nueva Mesa de Examen"}
                </DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="subject"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Materia *</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
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
                      name="profesorado"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Profesorado *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
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
                      name="teacher"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Docente *</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Fecha *</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="time"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Hora *</FormLabel>
                          <FormControl>
                            <Input type="time" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-4">
                    <Button 
                      type="button" 
                      variant="outline"
                      onClick={() => {
                        setIsAddModalOpen(false);
                        setEditingExam(null);
                        form.reset();
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button 
                      type="submit"
                      disabled={createExamMutation.isPending || updateExamMutation.isPending}
                    >
                      {editingExam ? "Actualizar" : "Crear"} Mesa
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {isExamSchedulesLoading ? (
          <div className="text-center py-8">Cargando mesas de examen...</div>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Materia</TableHead>
                  <TableHead>Año</TableHead>
                  <TableHead>Profesorado</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Hora</TableHead>
                  <TableHead>Docente</TableHead>
                  <TableHead>Inscriptos</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {examSchedules.map(exam => (
                  <TableRow key={exam.id}>
                    <TableCell>{exam.subject}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{exam.year}°</Badge>
                    </TableCell>
                    <TableCell>
                      {profesoradoOptions.find(p => p.value === exam.profesorado)?.label || exam.profesorado}
                    </TableCell>
                    <TableCell>{exam.date}</TableCell>
                    <TableCell>{exam.time}</TableCell>
                    <TableCell>{exam.teacher}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{getEnrolledCount(exam.id)}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleToggleVisibility(exam)}
                          disabled={toggleVisibilityMutation.isPending}
                          title={exam.registrationOpen ? "Ocultar mesa en formulario" : "Mostrar mesa en formulario"}
                          data-testid={`button-toggle-visibility-${exam.id}`}
                        >
                          {exam.registrationOpen ? (
                            <Eye className="w-4 h-4 text-green-600" />
                          ) : (
                            <EyeOff className="w-4 h-4 text-gray-400" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(exam)}
                          data-testid={`button-edit-${exam.id}`}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(exam.id)}
                          disabled={deleteExamMutation.isPending}
                          data-testid={`button-delete-${exam.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </TabsContent>

      {/* Inscriptions Tab */}
      <TabsContent value="inscriptions" className="space-y-4">
        <div className="flex justify-between items-center">
          <h5 className="text-lg font-medium">Lista de Inscripciones</h5>
          <Button 
            onClick={handleExportExcel}
            disabled={exportMutation.isPending}
            variant="outline"
          >
            <Download className="w-4 h-4 mr-2" />
            {exportMutation.isPending ? "Exportando..." : "Exportar a Excel"}
          </Button>
        </div>

        {isInscriptionsLoading ? (
          <div className="text-center py-8">Cargando inscripciones...</div>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Estudiante</TableHead>
                  <TableHead>DNI</TableHead>
                  <TableHead>Profesorado</TableHead>
                  <TableHead>Materias</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha Inscripción</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inscriptions.map((inscription: any) => (
                  <TableRow key={inscription.id}>
                    <TableCell>
                      {inscription.student ? `${inscription.student.lastName}, ${inscription.student.firstName}` : 'N/A'}
                    </TableCell>
                    <TableCell>{inscription.student?.dni || 'N/A'}</TableCell>
                    <TableCell>
                      {inscription.student ? 
                        profesoradoOptions.find(p => p.value === inscription.student.profesorado)?.label || inscription.student.profesorado
                        : 'N/A'
                      }
                    </TableCell>
                    <TableCell>
                      <div className="max-w-xs">
                        {inscription.examSchedules?.map((exam: ExamSchedule) => (
                          <div key={exam.id} className="text-sm mb-1">
                            {exam.year}° - {exam.subject}
                          </div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(inscription.status)}
                    </TableCell>
                    <TableCell>
                      {inscription.createdAt ? new Date(inscription.createdAt).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : 'N/A'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {inscription.status === "pending" && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleStatusUpdate(inscription.id, "confirmed")}
                              disabled={updateInscriptionStatusMutation.isPending}
                              className="text-green-600 border-green-600 hover:bg-green-50"
                            >
                              <Check className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleStatusUpdate(inscription.id, "rejected")}
                              disabled={updateInscriptionStatusMutation.isPending}
                              className="text-red-600 border-red-600 hover:bg-red-50"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                        {inscription.status !== "pending" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleStatusUpdate(inscription.id, "pending")}
                            disabled={updateInscriptionStatusMutation.isPending}
                          >
                            <Clock className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {inscriptions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No hay inscripciones registradas
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </TabsContent>

      {/* Reports Tab */}
      <TabsContent value="reports" className="space-y-4">
        <div className="flex justify-between items-center">
          <h5 className="text-lg font-medium">Estadísticas del Sistema</h5>
        </div>

        {isStatsLoading ? (
          <div className="text-center py-8">Cargando estadísticas...</div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Estudiantes</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{statistics.totalStudents || 0}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Inscripciones</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{statistics.totalInscriptions || 0}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Mesas de Examen</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{statistics.totalExamSchedules || 0}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Materias</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{statistics.totalSubjects || 0}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Profesorados</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{statistics.totalProfesorados || 0}</div>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Inscripciones por Estado</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {['pending', 'confirmed', 'rejected'].map(status => {
                  const count = inscriptions.filter((i: any) => i.status === status).length;
                  const percentage = inscriptions.length > 0 ? Math.round((count / inscriptions.length) * 100) : 0;
                  
                  return (
                    <div key={status} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getStatusBadge(status)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {count} ({percentage}%)
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Inscripciones por Profesorado</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {profesoradoOptions.map(profesorado => {
                  const count = inscriptions.filter((i: any) => 
                    i.student?.profesorado === profesorado.value
                  ).length;
                  
                  return (
                    <div key={profesorado.value} className="flex items-center justify-between">
                      <span className="text-sm">{profesorado.label}</span>
                      <Badge variant="outline">{count}</Badge>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </TabsContent>
    </Tabs>
  );
}