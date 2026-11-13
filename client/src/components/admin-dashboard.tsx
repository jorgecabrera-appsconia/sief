import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { StatisticsModal } from "./statistics-modal";
import AdminUsersPanel from "./admin-users-panel";
import PasswordChangeForm from "./password-change-form";
import { LogOut, Download, FileText, Search, Filter, Edit, Check, X, Plus, Trash2, Pencil, FileSpreadsheet, AlertTriangle, Wrench, WrenchIcon, ChevronDown, ChevronUp, Eye, EyeOff, Copy, KeyRound } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { formatDateDDMMYY } from "@/lib/utils";
import type { ExamSchedule, Inscription, Student, ExamCall } from "@shared/schema";

// Form validation schema
const examFormSchema = z.object({
  subject: z.string().min(1, "La materia es obligatoria"),
  year: z.number().min(1).max(4),
  profesorado: z.string().min(1, "El profesorado es obligatorio"),
  turno: z.string().min(1, "El turno es obligatorio"),
  division: z.string().min(1, "La división es obligatoria"),
  date: z.string().min(1, "La fecha es obligatoria"),
  time: z.string().min(1, "La hora es obligatoria"),
  teacher: z.string().min(1, "El docente es obligatorio"),
  presidente: z.string().min(1, "El presidente es obligatorio"),
  vocal1: z.string().min(1, "El vocal 1° es obligatorio"),
  vocal2: z.string().min(1, "El vocal 2° es obligatorio"),
  vocalSuplente: z.string().min(1, "El vocal suplente es obligatorio"),
});

type ExamFormData = z.infer<typeof examFormSchema>;

// Component to show subjects with correlativities indicator and condition badge
const SubjectWithCorrelativities = ({ exam, allSubjects }: { exam: any; allSubjects: any[] }) => {
  const [correlativities, setCorrelativities] = useState<any[]>([]);
  const [hasCorrelativities, setHasCorrelativities] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const checkCorrelativities = async () => {
      setLoading(true);
      try {
        // Find the subject that matches this exam
        const matchingSubject = allSubjects.find(s => 
          s.name === exam.subject && s.profesorado === exam.profesorado
        );
        
        if (matchingSubject) {
          // Get correlativities for this subject
          const response = await fetch(`/api/subjects/${matchingSubject.id}/correlativities`);
          const correlativitiesData = await response.json();
          
          setCorrelativities(correlativitiesData);
          setHasCorrelativities(correlativitiesData.length > 0);
        }
      } catch (error) {
        console.error("Error checking correlativities:", error);
      } finally {
        setLoading(false);
      }
    };

    checkCorrelativities();
  }, [exam, allSubjects]);

  const subjectClassName = hasCorrelativities 
    ? "text-orange-600 font-medium cursor-help" 
    : "text-gray-900 font-medium";

  // Condition badge (Regular or Libre)
  const ConditionBadge = () => {
    if (exam.condition === "libre") {
      return (
        <span className="ml-2 px-1.5 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 rounded">
          Libre
        </span>
      );
    }
    return null; // Don't show badge for Regular (default)
  };

  if (loading) {
    return (
      <div className="text-sm flex items-center">
        <span className="font-medium">{exam.subject}</span>
        <span className="text-gray-500 ml-1">({exam.year}° año)</span>
        <ConditionBadge />
      </div>
    );
  }

  if (hasCorrelativities) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="text-sm flex items-center gap-1">
              <AlertTriangle className="w-4 h-4 text-orange-500" />
              <span className={subjectClassName}>{exam.subject}</span>
              <span className="text-gray-500 ml-1">({exam.year}° año)</span>
              <ConditionBadge />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="max-w-xs">
              <p className="font-medium mb-2">Materias correlativas requeridas:</p>
              <ul className="list-disc list-inside space-y-1">
                {correlativities.map((prereq, index) => (
                  <li key={index} className="text-sm">{prereq.name}</li>
                ))}
              </ul>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className="text-sm flex items-center">
      <span className="font-medium">{exam.subject}</span>
      <span className="text-gray-500 ml-1">({exam.year}° año)</span>
      <ConditionBadge />
    </div>
  );
};

interface AdminDashboardProps {
  user: any;
  onLogout: () => void;
  onUserUpdated: (user: any) => void;
}

/**
 * Complete administrative dashboard with exam schedules and inscription management
 * Features filtering, search, Excel export, and PDF generation capabilities
 */
export default function AdminDashboard({ user, onLogout, onUserUpdated }: AdminDashboardProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTurno, setFilterTurno] = useState("");
  const [filterProfesorado, setFilterProfesorado] = useState("");
  const [filterDivision, setFilterDivision] = useState("");
  const [filterYear, setFilterYear] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [filterTeacher, setFilterTeacher] = useState("");
  const [filterExamCall, setFilterExamCall] = useState("all");
  const [filterCondition, setFilterCondition] = useState("");
  const [isExamFormOpen, setIsExamFormOpen] = useState(false);
  const [isPasswordFormOpen, setIsPasswordFormOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<ExamSchedule | null>(null);
  const [isSubjectFormOpen, setIsSubjectFormOpen] = useState(false);
  const [subjectFormSource, setSubjectFormSource] = useState<"catalog" | "exam">("catalog");
  const [newSubjectName, setNewSubjectName] = useState("");
  const [newSubjectProfesorado, setNewSubjectProfesorado] = useState("");
  const [newSubjectYear, setNewSubjectYear] = useState("");
  const [newSubjectTurno, setNewSubjectTurno] = useState("");
  const [newSubjectDivision, setNewSubjectDivision] = useState("");
  const [editingSubject, setEditingSubject] = useState<{ id: number; name: string; profesorado: string; year: number } | null>(null);
  const [editSubjectName, setEditSubjectName] = useState("");
  const [editSubjectProfesorado, setEditSubjectProfesorado] = useState("");
  const [editSubjectYear, setEditSubjectYear] = useState("");
  const [subjectFilterProfesorado, setSubjectFilterProfesorado] = useState("all");
  const [subjectSearch, setSubjectSearch] = useState("");
  const [isInscriptionFormOpen, setIsInscriptionFormOpen] = useState(false);
  const [editingInscription, setEditingInscription] = useState<any>(null);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [showArchivedInscriptions, setShowArchivedInscriptions] = useState(false);
  const [isTeacherFormOpen, setIsTeacherFormOpen] = useState(false);
  const [newTeacherFirstName, setNewTeacherFirstName] = useState("");
  const [newTeacherLastName, setNewTeacherLastName] = useState("");
  const [isExamCallFormOpen, setIsExamCallFormOpen] = useState(false);
  const [newExamCallName, setNewExamCallName] = useState("");
  const [newExamCallStartDate, setNewExamCallStartDate] = useState("");
  const [newExamCallEndDate, setNewExamCallEndDate] = useState("");
  const [editingExamCall, setEditingExamCall] = useState<ExamCall | null>(null);
  const [isEditExamCallFormOpen, setIsEditExamCallFormOpen] = useState(false);
  const [isCloneExamCallFormOpen, setIsCloneExamCallFormOpen] = useState(false);
  const [cloningExamCall, setCloningExamCall] = useState<ExamCall | null>(null);
  const [cloneExamCallName, setCloneExamCallName] = useState("");
  const [cloneExamCallStartDate, setCloneExamCallStartDate] = useState("");
  const [cloneExamCallEndDate, setCloneExamCallEndDate] = useState("");
  // Filters for inscription exam selection
  const [inscriptionFilterProfesorado, setInscriptionFilterProfesorado] = useState("");
  const [inscriptionFilterTurno, setInscriptionFilterTurno] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Exam form setup
  const form = useForm<ExamFormData>({
    resolver: zodResolver(examFormSchema),
    defaultValues: {
      subject: "",
      year: 1,
      profesorado: "",
      turno: "",
      division: "",
      date: "",
      time: "",
      teacher: "",
      presidente: "",
      vocal1: "",
      vocal2: "",
      vocalSuplente: "",
    },
  });

  // Inscription form setup
  const inscriptionForm = useForm({
    defaultValues: {
      firstName: "",
      lastName: "",
      dni: "",
      phone: "",
      email: "",
      profesorado: "",
      turno: "",
      year: 1,
      division: "",
      selectedExams: [] as number[],
    },
  });

  // Reset form when editing exam changes
  useEffect(() => {
    if (editingExam) {
      form.reset({
        subject: editingExam.subject,
        year: editingExam.year,
        profesorado: editingExam.profesorado,
        turno: editingExam.turno,
        division: editingExam.division,
        date: editingExam.date,
        time: editingExam.time,
        teacher: editingExam.teacher,
        presidente: editingExam.presidente,
        vocal1: editingExam.vocal1,
        vocal2: editingExam.vocal2,
        vocalSuplente: editingExam.vocalSuplente,
      });
    } else {
      form.reset({
        subject: "",
        year: 1,
        profesorado: "",
        turno: "",
        division: "",
        date: "",
        time: "",
        teacher: "",
        presidente: "",
        vocal1: "",
        vocal2: "",
        vocalSuplente: "",
      });
    }
  }, [editingExam, form]);

  // Fetch data
  const { data: examSchedules = [] } = useQuery<ExamSchedule[]>({
    queryKey: ["/api/exam-schedules"],
  });

  const { data: inscriptions = [] } = useQuery<any[]>({
    queryKey: ["/api/inscriptions"],
  });

  // Fetch all subjects for dropdown
  const { data: allSubjects = [] } = useQuery<any[]>({
    queryKey: ["/api/subjects"],
  });

  const { data: students = [] } = useQuery<Student[]>({
    queryKey: ["/api/students"],
  });

  const { data: teachers = [] } = useQuery<any[]>({
    queryKey: ["/api/teachers"],
  });

  // Fetch active exam call
  const { data: activeExamCall } = useQuery<ExamCall | null>({
    queryKey: ["/api/exam-calls/active"],
  });

  // Fetch all exam calls
  const { data: examCalls = [] } = useQuery<ExamCall[]>({
    queryKey: ["/api/exam-calls"],
  });

  // Track previous active call so we can auto-follow when it changes
  const prevActiveCallIdRef = React.useRef<number | null>(null);

  // Auto-select active exam call in the filter:
  // - on initial load (filter is "all")
  // - when active call changes and admin hasn't manually picked a different call
  useEffect(() => {
    if (!activeExamCall?.id) return;
    const prev = prevActiveCallIdRef.current;
    const isFollowingActive = filterExamCall === "all" || filterExamCall === String(prev);
    if (isFollowingActive) {
      setFilterExamCall(activeExamCall.id.toString());
    }
    prevActiveCallIdRef.current = activeExamCall.id;
  }, [activeExamCall?.id]);

  // Filter exam schedules by active exam call (prefer examCallId, fallback to date range)
  const activeExamSchedules = examSchedules.filter(exam => {
    if (!activeExamCall) return false;
    if (exam.examCallId != null) return exam.examCallId === activeExamCall.id;
    if (!activeExamCall.startDate || !activeExamCall.endDate || !exam.date) return false;
    return exam.date >= activeExamCall.startDate && exam.date <= activeExamCall.endDate;
  });

  // Check maintenance mode status
  const { data: maintenanceData } = useQuery({
    queryKey: ["/api/maintenance/status"],
    queryFn: async () => {
      try {
        const response = await apiRequest("GET", "/api/maintenance/status");
        return response.json();
      } catch {
        return { maintenanceMode: false };
      }
    },
    refetchInterval: 30000, // Check every 30 seconds
  });

  useEffect(() => {
    if (maintenanceData?.maintenanceMode !== undefined) {
      setMaintenanceMode(maintenanceData.maintenanceMode);
    }
  }, [maintenanceData]);

  // Maintenance mode toggle mutation
  const toggleMaintenanceMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      return await apiRequest("POST", "/api/maintenance/toggle", { enabled });
    },
    onSuccess: (response: any) => {
      setMaintenanceMode(response.maintenanceMode);
      queryClient.invalidateQueries({ queryKey: ["/api/maintenance/status"] });
      toast({
        title: response.message,
        description: response.maintenanceMode 
          ? "El sistema está en modo mantenimiento. Solo superadmin puede acceder."
          : "El sistema está disponible para todos los usuarios."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error al cambiar modo mantenimiento",
        variant: "destructive",
      });
    },
  });

  // Update inscription status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      return await apiRequest("PATCH", `/api/inscriptions/${id}/status`, {
        status,
        confirmedBy: user.username,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inscriptions"] });
      toast({
        title: "Estado actualizado",
        description: "El estado de la inscripción ha sido actualizado",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error al actualizar el estado",
        variant: "destructive",
      });
    },
  });

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/auth/logout", {});
    },
    onSuccess: () => {
      onLogout();
    },
  });

  // Activate exam call mutation
  const activateExamCallMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("PATCH", `/api/exam-calls/${id}/activate`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exam-calls"] });
      queryClient.invalidateQueries({ queryKey: ["/api/exam-calls/active"] });
      toast({
        title: "Llamado activado",
        description: "El llamado de examen ha sido activado correctamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error al activar el llamado",
        variant: "destructive",
      });
    },
  });

  // Create exam call mutation
  const createExamCallMutation = useMutation({
    mutationFn: async (data: { name: string; startDate: string; endDate: string }) => {
      return await apiRequest("POST", "/api/exam-calls", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exam-calls"] });
      toast({
        title: "Llamado creado",
        description: "El llamado de examen ha sido creado correctamente",
      });
      setIsExamCallFormOpen(false);
      setNewExamCallName("");
      setNewExamCallStartDate("");
      setNewExamCallEndDate("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error al crear el llamado",
        variant: "destructive",
      });
    },
  });

  // Update exam call mutation
  const updateExamCallMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: { name: string; startDate: string; endDate: string } }) => {
      return await apiRequest("PUT", `/api/exam-calls/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exam-calls"] });
      queryClient.invalidateQueries({ queryKey: ["/api/exam-calls/active"] });
      toast({
        title: "Llamado actualizado",
        description: "El llamado de examen ha sido actualizado correctamente",
      });
      setIsEditExamCallFormOpen(false);
      setEditingExamCall(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error al actualizar el llamado",
        variant: "destructive",
      });
    },
  });

  // Clone exam call mutation
  const cloneExamCallMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: { name: string; startDate: string; endDate: string } }) => {
      const response = await apiRequest("POST", `/api/exam-calls/${id}/clone`, data);
      return await response.json();
    },
    onSuccess: (data: { examCall: ExamCall; clonedSchedules: number }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/exam-calls"] });
      queryClient.invalidateQueries({ queryKey: ["/api/exam-schedules"] });
      toast({
        title: "Llamado clonado",
        description: `Se ha creado el nuevo llamado con ${data.clonedSchedules} mesas de examen`,
      });
      setIsCloneExamCallFormOpen(false);
      setCloningExamCall(null);
      setCloneExamCallName("");
      setCloneExamCallStartDate("");
      setCloneExamCallEndDate("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error al clonar el llamado",
        variant: "destructive",
      });
    },
  });

  // Delete exam call mutation
  const deleteExamCallMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/exam-calls/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exam-calls"] });
      queryClient.invalidateQueries({ queryKey: ["/api/exam-calls/active"] });
      toast({
        title: "Llamado eliminado",
        description: "El llamado de examen ha sido eliminado correctamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error al eliminar el llamado",
        variant: "destructive",
      });
    },
  });

  // Exam schedule mutations
  const createExamMutation = useMutation({
    mutationFn: async (examData: any) => {
      return await apiRequest("POST", "/api/exam-schedules", examData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exam-schedules"] });
      toast({ title: "Mesa de examen creada correctamente" });
      setIsExamFormOpen(false);
      setEditingExam(null);
    },
    onError: (error: any) => {
      toast({ 
        title: "Error al crear mesa de examen", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  // Create a subject from the catalog or the exam form.
  const createSubjectMutation = useMutation({
    mutationFn: async (subjectData: { name: string; profesorado: string; year: number }) => {
      const res = await apiRequest("POST", "/api/subjects", subjectData);
      return await res.json() as { subject: { id: number; name: string; profesorado: string; year: number }; created: boolean };
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/subjects"] });
      if (subjectFormSource === "exam") {
        form.setValue("profesorado", data.subject.profesorado);
        form.setValue("year", data.subject.year);
        if (newSubjectTurno) form.setValue("turno", newSubjectTurno);
        if (newSubjectDivision) form.setValue("division", newSubjectDivision);
        form.setValue("subject", data.subject.name);
      } else {
        setSubjectFilterProfesorado(data.subject.profesorado);
        setSubjectSearch("");
      }
      toast({
        title: data.created ? "Materia creada correctamente" : "La materia ya existía",
        description: subjectFormSource === "exam"
          ? `La materia "${data.subject.name}" quedó seleccionada en la mesa.`
          : `"${data.subject.name}" · ${data.subject.profesorado} · ${data.subject.year}° año.`,
      });
      setIsSubjectFormOpen(false);
      setNewSubjectName("");
      setNewSubjectTurno("");
      setNewSubjectDivision("");
    },
    onError: (error: any) => {
      toast({
        title: "Error al crear materia",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update subject (materia) from the materias management tab
  const updateSubjectMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: { name: string; profesorado: string; year: number } }) => {
      const res = await apiRequest("PATCH", `/api/subjects/${id}`, data);
      return await res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/subjects"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/exam-schedules"] });
      toast({ title: "Materia actualizada correctamente" });
      setEditingSubject(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error al actualizar materia",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete subject (materia) from the materias management tab
  const deleteSubjectMutation = useMutation({
    mutationFn: async ({ id, force }: { id: number; force?: boolean }) => {
      const res = await apiRequest("DELETE", `/api/subjects/${id}${force ? "?force=true" : ""}`);
      return await res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/subjects"] });
      toast({ title: "Materia eliminada correctamente" });
    },
    onError: (error: any) => {
      toast({
        title: "Error al eliminar materia",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDeleteSubject = async (subject: { id: number; name: string }) => {
    if (!window.confirm(`¿Está seguro de eliminar la materia "${subject.name}"?`)) {
      return;
    }
    try {
      const res = await apiRequest("DELETE", `/api/subjects/${subject.id}`);
      await res.json();
      await queryClient.invalidateQueries({ queryKey: ["/api/subjects"] });
      toast({ title: "Materia eliminada correctamente" });
    } catch (error: any) {
      // Conflict: the subject still has exam schedules (mesas) associated.
      let examCount: number | undefined;
      try {
        examCount = error?.body?.examCount ?? JSON.parse(error.message?.split(": ").slice(1).join(": "))?.examCount;
      } catch {
        examCount = undefined;
      }
      if (typeof examCount === "number" && examCount > 0) {
        const confirmForce = window.confirm(
          `La materia "${subject.name}" tiene ${examCount} mesa(s) de examen asociada(s). ` +
          `Si la elimina, esas mesas quedarán con una materia que ya no existe en el catálogo. ¿Desea eliminarla de todas formas?`
        );
        if (confirmForce) {
          deleteSubjectMutation.mutate({ id: subject.id, force: true });
        }
        return;
      }
      toast({
        title: "Error al eliminar materia",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const updateExamMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      try {
        return await apiRequest("PATCH", `/api/exam-schedules/${id}`, data);
      } catch (error: any) {
        console.error("Error updating exam:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exam-schedules"] });
      toast({ title: "Mesa de examen actualizada correctamente" });
      setIsExamFormOpen(false);
      setEditingExam(null);
    },
    onError: (error: any) => {
      console.error("Mutation error:", error);
      toast({ 
        title: "Error al actualizar mesa de examen", 
        description: error?.message || "Error desconocido",
        variant: "destructive" 
      });
    },
  });

  const deleteExamMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/exam-schedules/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exam-schedules"] });
      toast({ title: "Mesa de examen eliminada correctamente" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error al eliminar mesa de examen", 
        description: error.message,
        variant: "destructive" 
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
        title: "Error al actualizar la visibilidad",
        description: error.message || "Error al actualizar la visibilidad",
        variant: "destructive",
      });
    },
  });

  const createTeacherMutation = useMutation({
    mutationFn: async (teacherData: { firstName: string; lastName: string; fullName: string }) => {
      const response = await apiRequest("POST", "/api/teachers", teacherData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teachers"] });
      setIsTeacherFormOpen(false);
      setNewTeacherFirstName("");
      setNewTeacherLastName("");
      
      // Close and reopen exam form modal if it's open to refresh teacher list
      if (isExamFormOpen) {
        setIsExamFormOpen(false);
        setTimeout(() => setIsExamFormOpen(true), 100);
      }
      
      toast({
        title: "Docente creado",
        description: "El docente ha sido agregado correctamente. Si tenía el formulario de mesa abierto, se ha refrescado automáticamente.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error al crear docente",
        description: error.message || "Error al crear el docente",
        variant: "destructive",
      });
    },
  });

  // Update inscription mutation
  const updateInscriptionMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return await apiRequest("PATCH", `/api/inscriptions/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inscriptions"] });
      setIsInscriptionFormOpen(false);
      setEditingInscription(null);
      inscriptionForm.reset();
      toast({
        title: "Inscripción actualizada",
        description: "La inscripción ha sido actualizada correctamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error al actualizar la inscripción",
        variant: "destructive",
      });
    },
  });

  // Form submission handler
  const onSubmit = async (data: ExamFormData) => {
    try {
      if (editingExam) {
        await updateExamMutation.mutateAsync({ id: editingExam.id, data });
      } else {
        await createExamMutation.mutateAsync(data);
      }
    } catch (error) {
      console.error("Form submission error:", error);
      // Error handling is done in the mutation's onError callback
    }
  };

  // Filter functions
  const filteredExamSchedules = examSchedules.filter(exam => {
    const matchesSearch = exam.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         exam.teacher.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         exam.presidente.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTurno = filterTurno === "all" || !filterTurno || exam.turno === filterTurno;
    const matchesProfesorado = filterProfesorado === "all" || !filterProfesorado || exam.profesorado === filterProfesorado;
    const matchesYear = filterYear === "all" || !filterYear || exam.year.toString() === filterYear;
    const matchesDivision = filterDivision === "all" || !filterDivision || exam.division === filterDivision;
    
    // Filter by exam call (prefer examCallId, fallback to date range)
    let matchesExamCall = true;
    if (filterExamCall !== "all") {
      const selectedCallId = parseInt(filterExamCall);
      const selectedCall = examCalls.find(call => call.id.toString() === filterExamCall);
      if (exam.examCallId != null) {
        matchesExamCall = exam.examCallId === selectedCallId;
      } else if (selectedCall?.startDate && selectedCall?.endDate && exam.date) {
        matchesExamCall = exam.date >= selectedCall.startDate && exam.date <= selectedCall.endDate;
      } else {
        matchesExamCall = false;
      }
    }
    
    return matchesSearch && matchesTurno && matchesProfesorado && matchesYear && matchesDivision && matchesExamCall;
  });

  // Helper function to check if inscription is within active exam call (prefer examCallId, fallback to date range)
  const isInscriptionInActiveCall = (inscription: any) => {
    if (!inscription.examSchedules || inscription.examSchedules.length === 0) return false;
    if (!activeExamCall) return false;
    
    const activeCallId = activeExamCall.id;
    const startDate = activeExamCall.startDate;
    const endDate = activeExamCall.endDate;
    
    return inscription.examSchedules.some((exam: any) => {
      if (exam.examCallId != null) return exam.examCallId === activeCallId;
      if (!exam.date || !startDate || !endDate) return false;
      return exam.date >= startDate && exam.date <= endDate;
    });
  };

  // Helper function to check if inscription is from an inactive exam call (prefer examCallId, fallback to date range)
  const isInscriptionInInactiveCall = (inscription: any) => {
    if (!inscription.examSchedules || inscription.examSchedules.length === 0) return false;
    
    return examCalls.some(call => {
      if (call.isActive) return false;
      return inscription.examSchedules.some((exam: any) => {
        if (exam.examCallId != null) return exam.examCallId === call.id;
        if (!exam.date || !call.startDate || !call.endDate) return false;
        return exam.date >= call.startDate && exam.date <= call.endDate;
      });
    });
  };

  // Filter inscriptions for the active exam call
  const filteredInscriptions = inscriptions.filter(inscription => {
    if (!inscription || !inscription.student) return false;
    
    // Only show inscriptions for the active exam call (based on date range)
    if (!isInscriptionInActiveCall(inscription)) return false;
    
    const student = inscription.student;
    const searchTermLower = searchTerm.toLowerCase();
    
    const matchesSearch = !searchTerm || (
      (student.firstName && student.firstName.toLowerCase().includes(searchTermLower)) ||
      (student.lastName && student.lastName.toLowerCase().includes(searchTermLower)) ||
      (student.dni && student.dni.includes(searchTerm)) ||
      // También buscar en nombre completo concatenado
      (student.firstName && student.lastName && 
       `${student.firstName} ${student.lastName}`.toLowerCase().includes(searchTermLower)) ||
      (student.firstName && student.lastName && 
       `${student.lastName} ${student.firstName}`.toLowerCase().includes(searchTermLower))
    );
    
    const matchesTurno = filterTurno === "all" || !filterTurno || student.turno === filterTurno;
    const matchesProfesorado = filterProfesorado === "all" || !filterProfesorado || student.profesorado === filterProfesorado;
    const matchesYear = filterYear === "all" || !filterYear || 
      student.year?.toString() === filterYear ||
      inscription.examSchedules?.some((exam: any) => exam.year?.toString() === filterYear);
    const matchesDivision = filterDivision === "all" || !filterDivision || student.division === filterDivision;
    const matchesStatus = filterStatus === "all" || !filterStatus || inscription.status === filterStatus;
    
    // Filter by subject if selected
    const matchesSubject = !filterSubject || filterSubject === "all" || 
      inscription.examSchedules?.some((exam: any) => exam.subject === filterSubject);
    
    // Filter by condition (Regular/Libre)
    const matchesCondition = !filterCondition || filterCondition === "all" || 
      inscription.examSchedules?.some((exam: any) => exam.condition === filterCondition);
    
    return matchesSearch && matchesTurno && matchesProfesorado && matchesYear && matchesDivision && matchesStatus && matchesSubject && matchesCondition;
  });

  // Filter inscriptions for inactive exam calls (archived)
  const archivedInscriptions = inscriptions.filter(inscription => {
    if (!inscription || !inscription.student) return false;
    
    // Only show inscriptions from inactive exam calls (based on date range)
    if (!isInscriptionInInactiveCall(inscription)) return false;
    
    const student = inscription.student;
    const searchTermLower = searchTerm.toLowerCase();
    
    const matchesSearch = !searchTerm || (
      (student.firstName && student.firstName.toLowerCase().includes(searchTermLower)) ||
      (student.lastName && student.lastName.toLowerCase().includes(searchTermLower)) ||
      (student.dni && student.dni.includes(searchTerm)) ||
      // También buscar en nombre completo concatenado
      (student.firstName && student.lastName && 
       `${student.firstName} ${student.lastName}`.toLowerCase().includes(searchTermLower)) ||
      (student.firstName && student.lastName && 
       `${student.lastName} ${student.firstName}`.toLowerCase().includes(searchTermLower))
    );
    
    const matchesTurno = filterTurno === "all" || !filterTurno || student.turno === filterTurno;
    const matchesProfesorado = filterProfesorado === "all" || !filterProfesorado || student.profesorado === filterProfesorado;
    const matchesYear = filterYear === "all" || !filterYear || 
      student.year?.toString() === filterYear ||
      inscription.examSchedules?.some((exam: any) => exam.year?.toString() === filterYear);
    const matchesDivision = filterDivision === "all" || !filterDivision || student.division === filterDivision;
    const matchesStatus = filterStatus === "all" || !filterStatus || inscription.status === filterStatus;
    
    // Filter by subject if selected
    const matchesSubject = !filterSubject || filterSubject === "all" || 
      inscription.examSchedules?.some((exam: any) => exam.subject === filterSubject);
    
    return matchesSearch && matchesTurno && matchesProfesorado && matchesYear && matchesDivision && matchesStatus && matchesSubject;
  });

  // Helper: resolve the llamado name for a given exam schedule
  const getExamCallName = (exam: ExamSchedule): string => {
    if (exam.examCallId != null) {
      const call = examCalls.find(c => c.id === exam.examCallId);
      if (call) return call.name;
    }
    return (exam as any).period || "Sin llamado";
  };

  // Export functions
  const exportExamSchedulesToExcel = async () => {
    const { exportInscriptionsToExcel } = await import("@/lib/excel-export");
    const dataToExport = filteredExamSchedules.map(exam => ({
      Materia: exam.subject,
      Año: exam.year,
      Profesorado: exam.profesorado,
      Turno: exam.turno,
      División: exam.division,
      Fecha: exam.date,
      Hora: exam.time,
      Docente: exam.teacher,
      Presidente: exam.presidente,
      Vocal1: exam.vocal1,
      Vocal2: exam.vocal2,
      VocalSuplente: exam.vocalSuplente,
    }));

    await exportInscriptionsToExcel(dataToExport as any);
    toast({
      title: "Exportación exitosa",
      description: "Las mesas de examen han sido exportadas a Excel",
    });
  };

  const exportInscriptionsToExcelFile = async () => {
    if (!filteredInscriptions || filteredInscriptions.length === 0) {
      toast({
        title: "Sin datos para exportar",
        description: "No hay inscripciones para exportar",
        variant: "destructive",
      });
      return;
    }
    
    // Filter exam schedules within each inscription to only include those from active call
    const inscriptionsWithFilteredExams = filteredInscriptions.map(inscription => ({
      ...inscription,
      examSchedules: (inscription.examSchedules || []).filter((exam: any) => {
        if (!activeExamCall?.startDate || !activeExamCall?.endDate || !exam.date) return false;
        return exam.date >= activeExamCall.startDate && exam.date <= activeExamCall.endDate;
      })
    }));
    
    const { exportInscriptionsToExcel } = await import("@/lib/excel-export");
    await exportInscriptionsToExcel(inscriptionsWithFilteredExams);
    toast({
      title: "Exportación exitosa",
      description: `Las inscripciones han sido exportadas a Excel` + 
        (activeExamCall ? ` para el llamado "${activeExamCall.name}"` : ""),
    });
  };

  const generatePermissionSlip = async (inscription: any) => {
    if (inscription.status !== "confirmed") {
      toast({
        title: "Error",
        description: "Solo se pueden generar permisos para inscripciones confirmadas",
        variant: "destructive",
      });
      return;
    }

    // Filter exam schedules by active exam call date range
    const filteredExamSchedules = (inscription.examSchedules || []).filter((exam: ExamSchedule) => {
      if (!activeExamCall?.startDate || !activeExamCall?.endDate || !exam.date) return false;
      return exam.date >= activeExamCall.startDate && exam.date <= activeExamCall.endDate;
    });

    if (filteredExamSchedules.length === 0) {
      toast({
        title: "Sin mesas en el llamado activo",
        description: activeExamCall 
          ? `Esta inscripción no tiene mesas del llamado "${activeExamCall.name}"`
          : "Esta inscripción no tiene mesas habilitadas",
        variant: "destructive",
      });
      return;
    }

    // Use the permission number from the inscription
    const permissionNumber = inscription.permissionNumber;
    const { generatePermissionSlipPDF } = await import(
      "@/lib/permission-slip-generator"
    );
    generatePermissionSlipPDF(inscription.student, filteredExamSchedules, permissionNumber);
    
    toast({
      title: "Permiso generado",
      description: `El permiso de examen N° ${String(permissionNumber).padStart(4, '0')} ha sido generado en PDF` + 
        (activeExamCall ? ` para el llamado "${activeExamCall.name}"` : ""),
    });
  };

  const generateActaVolante = async (format: 'pdf' | 'docx' = 'pdf') => {
    if (!filterSubject || filterSubject === "all") {
      toast({
        title: "Seleccione una materia",
        description: "Debe filtrar por una materia específica para generar el Acta Volante",
        variant: "destructive",
      });
      return;
    }
    
    if (!filterDivision || filterDivision === "all") {
      toast({
        title: "Seleccione una división",
        description: "Debe filtrar por una división específica para generar el Acta Volante",
        variant: "destructive",
      });
      return;
    }

    // Find the exam schedule for the selected subject and division, considering profesorado and turno filters
    // Only use active exam schedules (from the active exam call)
    const selectedExam = activeExamSchedules?.find(exam => 
      exam.subject === filterSubject && 
      exam.division === filterDivision &&
      (filterProfesorado === "all" || !filterProfesorado || exam.profesorado === filterProfesorado) &&
      (filterTurno === "all" || !filterTurno || exam.turno === filterTurno)
    );
    if (!selectedExam) {
      toast({
        title: "Error",
        description: activeExamCall 
          ? `No se encontró información de la mesa de examen en el llamado "${activeExamCall.name}" para la materia y división seleccionadas`
          : "No se encontró información de la mesa de examen para la materia y división seleccionadas",
        variant: "destructive",
      });
      return;
    }

    // Get confirmed inscriptions for this subject, filtered by active exam call date range
    const confirmedInscriptions = filteredInscriptions.filter(inscription => 
      inscription.status === 'confirmed' &&
      inscription.examSchedules?.some((exam: any) => {
        if (!activeExamCall?.startDate || !activeExamCall?.endDate || !exam.date) return false;
        return exam.subject === filterSubject &&
          exam.date >= activeExamCall.startDate && 
          exam.date <= activeExamCall.endDate;
      })
    );

    if (confirmedInscriptions.length === 0) {
      toast({
        title: "Sin inscripciones confirmadas",
        description: "No hay inscripciones confirmadas para esta materia",
        variant: "destructive",
      });
      return;
    }

    // Extract condition for each inscription for this specific subject
    const inscriptionsWithCondition = confirmedInscriptions.map(inscription => {
      const examForSubject = inscription.examSchedules?.find((exam: any) => exam.subject === filterSubject);
      return {
        ...inscription,
        conditionForSubject: examForSubject?.condition || "regular"
      };
    });

    // Generate the PDF or DOCX based on format
    if (format === 'pdf') {
      const { generateActaVolantePDF } = await import(
        "@/lib/acta-volante-generator"
      );
      generateActaVolantePDF({
        examSchedule: selectedExam,
        inscriptions: inscriptionsWithCondition,
        students: confirmedInscriptions.map(i => i.student).filter(Boolean)
      });
      
      toast({
        title: "Acta Volante generada",
        description: `Se generó el Acta Volante en PDF para ${filterSubject}`,
      });
    } else {
      const { generateActaVolanteDOCX } = await import(
        "@/lib/acta-volante-docx-generator"
      );
      generateActaVolanteDOCX({
        examSchedule: selectedExam,
        inscriptions: inscriptionsWithCondition,
        students: confirmedInscriptions.map(i => i.student).filter(Boolean)
      });
      
      toast({
        title: "Acta Volante generada",
        description: `Se generó el Acta Volante en DOCX para ${filterSubject}`,
      });
    }
  };

  const updateInscriptionStatus = (id: number, status: string) => {
    updateStatusMutation.mutate({ id, status });
  };

  const handleEditInscription = (inscription: any) => {
    // Populate form with existing inscription data
    inscriptionForm.reset({
      firstName: inscription.student?.firstName || "",
      lastName: inscription.student?.lastName || "",
      dni: inscription.student?.dni || "",
      phone: inscription.student?.phone || "",
      email: inscription.student?.email || "",
      profesorado: inscription.student?.profesorado || "",
      turno: inscription.student?.turno || "",
      year: inscription.student?.year || 1,
      selectedExams: inscription.examSchedules?.map((exam: any) => exam.id) || []
    });
    
    // Reset inscription filters to show all exams initially
    setInscriptionFilterProfesorado("all");
    setInscriptionFilterTurno("all");
    
    setEditingInscription(inscription);
    setIsInscriptionFormOpen(true);
  };

  // Get available exams for inscription editing - admin can see ALL exams without restrictions
  const availableExamsForInscription = examSchedules?.filter(exam => {
    // Apply only the admin-controlled filters for inscription editing
    const matchesProfesorado = !inscriptionFilterProfesorado || inscriptionFilterProfesorado === "all" || exam.profesorado === inscriptionFilterProfesorado;
    const matchesTurno = !inscriptionFilterTurno || inscriptionFilterTurno === "all" || exam.turno === inscriptionFilterTurno;
    
    return matchesProfesorado && matchesTurno;
  })?.sort((a, b) => {
    // Sort by profesorado, then turno, then year, then subject
    if (a.profesorado !== b.profesorado) return a.profesorado.localeCompare(b.profesorado);
    if (a.turno !== b.turno) return a.turno.localeCompare(b.turno);
    if (a.year !== b.year) return a.year - b.year;
    return a.subject.localeCompare(b.subject);
  }) || [];

  // Get filtered subjects based on current filters
  const getFilteredSubjects = () => {
    if (!examSchedules) return [];
    
    let filteredExams = examSchedules;
    
    // Filter by turno if selected
    if (filterTurno && filterTurno !== "all") {
      filteredExams = filteredExams.filter(exam => exam.turno === filterTurno);
    }
    
    // Filter by profesorado if selected
    if (filterProfesorado && filterProfesorado !== "all") {
      filteredExams = filteredExams.filter(exam => exam.profesorado === filterProfesorado);
    }
    
    // Extract unique subjects and sort them
    return Array.from(new Set(filteredExams.map(exam => exam.subject))).sort();
  };

  const filteredSubjects = getFilteredSubjects();

  // Reset subject filter when turno or profesorado changes
  useEffect(() => {
    if (filterSubject && filterSubject !== "all" && !filteredSubjects.includes(filterSubject)) {
      setFilterSubject("");
    }
  }, [filterTurno, filterProfesorado, filterSubject, filteredSubjects]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-blue-800">
                Panel de Administración
              </h1>
              <p className="text-sm text-gray-600">
                ISFD "Dr. Pedro Ignacio de Castro Barros" - {user.role}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {user.role === 'superadmin' && (
                <Button
                  onClick={() => toggleMaintenanceMutation.mutate(!maintenanceMode)}
                  variant={maintenanceMode ? "destructive" : "secondary"}
                  size="sm"
                  disabled={toggleMaintenanceMutation.isPending}
                  className="flex items-center gap-2"
                >
                  <Wrench className="h-4 w-4" />
                  {maintenanceMode ? "Desactivar Mantenimiento" : "Activar Mantenimiento"}
                </Button>
              )}
              <Button
                onClick={() => setIsPasswordFormOpen(true)}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <KeyRound className="h-4 w-4" />
                Cambiar mi contraseña
              </Button>
              <Button
                onClick={() => logoutMutation.mutate()}
                variant="outline"
                className="flex items-center gap-2"
              >
                <LogOut className="h-4 w-4" />
                Cerrar Sesión
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="inscriptions" className="space-y-6">
          <TabsList className={user.role === "superadmin" ? "grid w-full grid-cols-2 lg:grid-cols-5" : "grid w-full grid-cols-2 lg:grid-cols-4"}>
            <TabsTrigger value="inscriptions">Gestión de Inscripciones</TabsTrigger>
            <TabsTrigger value="exams">Mesas de Examen</TabsTrigger>
            <TabsTrigger value="exam-calls">Llamados de Examen</TabsTrigger>
            <TabsTrigger value="subjects">Materias</TabsTrigger>
            {user.role === "superadmin" && <TabsTrigger value="users">Usuarios</TabsTrigger>}
          </TabsList>

          {/* Inscriptions Tab */}
          <TabsContent value="inscriptions" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Inscripciones {activeExamCall?.name || "Sin Llamado Activo"}</span>
                  <div className="flex gap-2">
                    <Button onClick={() => generateActaVolante('pdf')} variant="outline" size="sm">
                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                      Acta PDF
                    </Button>
                    <Button onClick={() => generateActaVolante('docx')} variant="outline" size="sm">
                      <FileText className="h-4 w-4 mr-2" />
                      Acta DOCX
                    </Button>
                    <Button onClick={exportInscriptionsToExcelFile} variant="outline" size="sm">
                      <Download className="h-4 w-4 mr-2" />
                      Exportar Excel
                    </Button>
                    <StatisticsModal />
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Main Filters - Order: Profesorado - Turno - Año - División - Materia */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
                  <div>
                    <Label>Profesorado</Label>
                    <Select value={filterProfesorado} onValueChange={setFilterProfesorado}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todos los profesorados" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos los profesorados</SelectItem>
                        <SelectItem value="Educación Inicial">Educación Inicial</SelectItem>
                        <SelectItem value="Educación Primaria">Educación Primaria</SelectItem>
                        <SelectItem value="Biología">Biología</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Turno</Label>
                    <Select value={filterTurno} onValueChange={setFilterTurno}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todos los turnos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos los turnos</SelectItem>
                        <SelectItem value="mañana">Mañana</SelectItem>
                        <SelectItem value="siesta">Siesta</SelectItem>
                        <SelectItem value="tarde">Tarde</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Año</Label>
                    <Select value={filterYear} onValueChange={setFilterYear}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todos los años" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos los años</SelectItem>
                        <SelectItem value="1">1° año</SelectItem>
                        <SelectItem value="2">2° año</SelectItem>
                        <SelectItem value="3">3° año</SelectItem>
                        <SelectItem value="4">4° año</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>División</Label>
                    <Select value={filterDivision} onValueChange={setFilterDivision}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todas las divisiones" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas las divisiones</SelectItem>
                        <SelectItem value="A">División A</SelectItem>
                        <SelectItem value="B">División B</SelectItem>
                        <SelectItem value="C">División C</SelectItem>
                        <SelectItem value="D">División D</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Materia</Label>
                    <Select value={filterSubject} onValueChange={setFilterSubject}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todas las materias" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas las materias</SelectItem>
                        {filteredSubjects.map(subject => (
                          <SelectItem key={subject} value={subject}>
                            {subject}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Search Filters */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div>
                    <Label htmlFor="search">Buscar Alumno (Nombre/DNI)</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="search"
                        placeholder="Buscar estudiante..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div>
                    <Label>Estado</Label>
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todos los estados" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos los estados</SelectItem>
                        <SelectItem value="pending">Pendiente</SelectItem>
                        <SelectItem value="confirmed">Confirmado</SelectItem>
                        <SelectItem value="rejected">Rechazado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Condición</Label>
                    <Select value={filterCondition} onValueChange={setFilterCondition}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todas las condiciones" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        <SelectItem value="regular">Regular</SelectItem>
                        <SelectItem value="libre">Libre</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Inscriptions Table */}
                <div className="overflow-x-auto">
                  <table className="w-full table-auto">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-left p-3">Estudiante</th>
                        <th className="text-left p-3">DNI</th>
                        <th className="text-left p-3">Profesorado</th>
                        <th className="text-left p-3">Turno</th>
                        <th className="text-left p-3">División</th>
                        <th className="text-left p-3">Materias</th>
                        <th className="text-left p-3">Estado</th>
                        <th className="text-left p-3">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredInscriptions.map((inscription) => (
                        <tr key={inscription.id} className="border-b hover:bg-gray-50">
                          <td className="p-3">
                            <div>
                              {inscription.student?.lastName}, {inscription.student?.firstName}
                              {inscription.student?.yearEntered && (
                                <div className="text-xs text-gray-500 mt-1">
                                  (Ingreso: {inscription.student.yearEntered})
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="p-3">{inscription.student?.dni}</td>
                          <td className="p-3">{inscription.student?.profesorado}</td>
                          <td className="p-3 capitalize">{inscription.student?.turno}</td>
                          <td className="p-3">{inscription.student?.division}</td>
                          <td className="p-3">
                            <div className="max-w-xs">
                              {inscription.examSchedules && inscription.examSchedules.length > 0 ? (
                                <div className="space-y-1">
                                  {inscription.examSchedules.map((exam: any, index: number) => (
                                    <SubjectWithCorrelativities 
                                      key={exam.id || index}
                                      exam={exam} 
                                      allSubjects={allSubjects}
                                    />
                                  ))}
                                </div>
                              ) : (
                                <span className="text-gray-400 text-sm">Sin materias</span>
                              )}
                            </div>
                          </td>
                          <td className="p-3">
                            <Badge 
                              variant={
                                inscription.status === "confirmed" ? "default" :
                                inscription.status === "rejected" ? "destructive" : "secondary"
                              }
                            >
                              {inscription.status === "pending" ? "Pendiente" :
                               inscription.status === "confirmed" ? "Confirmado" : "Rechazado"}
                            </Badge>
                          </td>
                          <td className="p-3">
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEditInscription(inscription)}
                                className="p-1 h-8 w-8"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              {inscription.status === "pending" && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => updateInscriptionStatus(inscription.id, "confirmed")}
                                    className="p-1 h-8 w-8"
                                    title="Confirmar inscripción"
                                  >
                                    <Check className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => updateInscriptionStatus(inscription.id, "rejected")}
                                    className="p-1 h-8 w-8"
                                    title="Rechazar inscripción"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                              {inscription.status === "confirmed" && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => generatePermissionSlip(inscription)}
                                    className="p-1 h-8 w-8"
                                    title="Generar permiso de examen"
                                  >
                                    <FileText className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => updateInscriptionStatus(inscription.id, "pending")}
                                    className="p-1 h-8 w-8 text-orange-600"
                                    title="Revertir a pendiente"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                              {inscription.status === "rejected" && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => updateInscriptionStatus(inscription.id, "pending")}
                                    className="p-1 h-8 w-8 text-orange-600"
                                    title="Revertir a pendiente"
                                  >
                                    <Check className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => updateInscriptionStatus(inscription.id, "confirmed")}
                                    className="p-1 h-8 w-8 text-green-600"
                                    title="Confirmar inscripción"
                                  >
                                    <Check className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {filteredInscriptions.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No hay inscripciones que coincidan con los filtros aplicados
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Archived Inscriptions (July 2025) - Collapsible */}
            {archivedInscriptions.length > 0 && (
              <Collapsible open={showArchivedInscriptions} onOpenChange={setShowArchivedInscriptions}>
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" className="p-0 h-8 w-8">
                            {showArchivedInscriptions ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>
                        </CollapsibleTrigger>
                        <CardTitle className="flex items-center gap-2">
                          <span>Inscripciones Archivadas (Llamados Anteriores)</span>
                          <Badge variant="secondary" className="text-sm">
                            Solo lectura • {archivedInscriptions.length} registros
                          </Badge>
                        </CardTitle>
                      </div>
                      <CollapsibleTrigger asChild>
                        <Button variant="outline" size="sm">
                          {showArchivedInscriptions ? "Ocultar" : "Mostrar"}
                        </Button>
                      </CollapsibleTrigger>
                    </div>
                  </CardHeader>
                  <CollapsibleContent>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full table-auto">
                          <thead>
                            <tr className="border-b bg-gray-50">
                              <th className="text-left p-3">Estudiante</th>
                              <th className="text-left p-3">DNI</th>
                              <th className="text-left p-3">Profesorado</th>
                              <th className="text-left p-3">Turno</th>
                              <th className="text-left p-3">División</th>
                              <th className="text-left p-3">Materias</th>
                              <th className="text-left p-3">Estado</th>
                            </tr>
                          </thead>
                          <tbody>
                            {archivedInscriptions.map((inscription) => (
                              <tr key={inscription.id} className="border-b hover:bg-gray-50">
                                <td className="p-3">
                                  <div>
                                    {inscription.student?.lastName}, {inscription.student?.firstName}
                                    {inscription.student?.yearEntered && (
                                      <div className="text-xs text-gray-500 mt-1">
                                        (Ingreso: {inscription.student.yearEntered})
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td className="p-3">{inscription.student?.dni}</td>
                                <td className="p-3">{inscription.student?.profesorado}</td>
                                <td className="p-3 capitalize">{inscription.student?.turno}</td>
                                <td className="p-3">{inscription.student?.division}</td>
                                <td className="p-3">
                                  <div className="max-w-xs">
                                    {inscription.examSchedules && inscription.examSchedules.length > 0 ? (
                                      <div className="space-y-1">
                                        {inscription.examSchedules.map((exam: any, index: number) => (
                                          <SubjectWithCorrelativities 
                                            key={exam.id || index}
                                            exam={exam} 
                                            allSubjects={allSubjects}
                                          />
                                        ))}
                                      </div>
                                    ) : (
                                      <span className="text-gray-400 text-sm">Sin materias</span>
                                    )}
                                  </div>
                                </td>
                                <td className="p-3">
                                  <Badge 
                                    variant={
                                      inscription.status === "confirmed" ? "default" :
                                      inscription.status === "rejected" ? "destructive" : "secondary"
                                    }
                                  >
                                    {inscription.status === "pending" ? "Pendiente" :
                                     inscription.status === "confirmed" ? "Confirmado" : "Rechazado"}
                                  </Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {archivedInscriptions.length === 0 && (
                        <div className="text-center py-8 text-gray-500">
                          No hay inscripciones archivadas que coincidan con los filtros aplicados
                        </div>
                      )}
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            )}
          </TabsContent>

          {/* Exam Schedules Tab */}
          <TabsContent value="exams" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Mesas de Examen</span>
                  <div className="flex gap-2">
                    <Button onClick={() => setIsExamFormOpen(true)} size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Nueva Mesa
                    </Button>
                    <Button onClick={() => setIsTeacherFormOpen(true)} variant="outline" size="sm" data-testid="button-new-teacher">
                      <Plus className="h-4 w-4 mr-2" />
                      Nuevo Docente
                    </Button>
                    <Button onClick={exportExamSchedulesToExcel} variant="outline" size="sm">
                      <Download className="h-4 w-4 mr-2" />
                      Exportar Excel
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Filters */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
                  <div>
                    <Label htmlFor="examSearch">Buscar Docente</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="examSearch"
                        placeholder="Buscar materia, docente..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div>
                    <Label>Profesorado</Label>
                    <Select value={filterProfesorado} onValueChange={setFilterProfesorado}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todos los profesorados" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos los profesorados</SelectItem>
                        <SelectItem value="Educación Inicial">Educación Inicial</SelectItem>
                        <SelectItem value="Educación Primaria">Educación Primaria</SelectItem>
                        <SelectItem value="Biología">Biología</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Año</Label>
                    <Select value={filterYear} onValueChange={setFilterYear}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todos los años" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos los años</SelectItem>
                        <SelectItem value="1">1° Año</SelectItem>
                        <SelectItem value="2">2° Año</SelectItem>
                        <SelectItem value="3">3° Año</SelectItem>
                        <SelectItem value="4">4° Año</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Turno</Label>
                    <Select value={filterTurno} onValueChange={setFilterTurno}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todos los turnos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos los turnos</SelectItem>
                        <SelectItem value="mañana">Mañana</SelectItem>
                        <SelectItem value="siesta">Siesta</SelectItem>
                        <SelectItem value="tarde">Tarde</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>División</Label>
                    <Select value={filterDivision} onValueChange={setFilterDivision}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todas las divisiones" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas las divisiones</SelectItem>
                        <SelectItem value="A">División A</SelectItem>
                        <SelectItem value="B">División B</SelectItem>
                        <SelectItem value="C">División C</SelectItem>
                        <SelectItem value="D">División D</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Exam Call Filter */}
                <div className="mb-4">
                  <Label>Filtrar por Llamado</Label>
                  <Select value={filterExamCall} onValueChange={setFilterExamCall}>
                    <SelectTrigger className="w-full md:w-[300px]">
                      <SelectValue placeholder="Todos los llamados" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los llamados</SelectItem>
                      {examCalls.map(call => (
                        <SelectItem key={call.id} value={call.id.toString()}>
                          {call.name} {call.isActive && "(Activo)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Exam Schedules Table - Mobile Responsive */}
                <div className="overflow-x-auto">
                  <table className="w-full table-auto min-w-[600px]">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-left p-2 sm:p-3 text-sm sm:text-base">Materia</th>
                        <th className="text-left p-2 sm:p-3 text-sm sm:text-base">Año</th>
                        <th className="text-left p-2 sm:p-3 text-sm sm:text-base">División</th>
                        <th className="text-left p-2 sm:p-3 text-sm sm:text-base">Fecha/Hora</th>
                        <th className="text-left p-2 sm:p-3 text-sm sm:text-base">Docente</th>
                        <th className="text-left p-2 sm:p-3 text-sm sm:text-base hidden md:table-cell">Mesa</th>
                        <th className="text-left p-2 sm:p-3 text-sm sm:text-base">Turno</th>
                        <th className="text-left p-2 sm:p-3 text-sm sm:text-base hidden lg:table-cell">Llamado</th>
                        <th className="text-left p-2 sm:p-3 text-sm sm:text-base">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredExamSchedules.map((exam) => (
                        <tr key={exam.id} className="border-b hover:bg-gray-50">
                          <td className="p-2 sm:p-3 font-medium text-sm sm:text-base">{exam.subject}</td>
                          <td className="p-2 sm:p-3 text-sm sm:text-base">{exam.year}°</td>
                          <td className="p-2 sm:p-3 text-sm sm:text-base">{exam.division}</td>
                          <td className="p-2 sm:p-3">
                            <div className="text-xs sm:text-sm">
                              <div className="font-medium">{formatDateDDMMYY(exam.date)}</div>
                              <div className="text-gray-500">{exam.time}</div>
                            </div>
                          </td>
                          <td className="p-2 sm:p-3 text-sm sm:text-base">{exam.teacher}</td>
                          <td className="p-2 sm:p-3 hidden md:table-cell">
                            <div className="text-xs">
                              <div><strong>Pres:</strong> {exam.presidente}</div>
                              <div><strong>V1:</strong> {exam.vocal1}</div>
                              <div><strong>V2:</strong> {exam.vocal2}</div>
                              <div className="text-gray-500"><strong>Supl:</strong> {exam.vocalSuplente}</div>
                            </div>
                          </td>
                          <td className="p-2 sm:p-3 capitalize text-sm sm:text-base">{exam.turno}</td>
                          <td className="p-2 sm:p-3 text-xs sm:text-sm text-gray-600 hidden lg:table-cell">
                            {getExamCallName(exam)}
                          </td>
                          <td className="p-2 sm:p-3">
                            <div className="flex gap-1 sm:gap-2">
                              <Button
                                onClick={() => {
                                  toggleVisibilityMutation.mutate({ 
                                    id: exam.id, 
                                    registrationOpen: !exam.registrationOpen 
                                  });
                                }}
                                size="sm"
                                variant="outline"
                                className="p-1 h-8 w-8"
                                title={exam.registrationOpen ? "Ocultar mesa en formulario" : "Mostrar mesa en formulario"}
                                data-testid={`button-toggle-visibility-${exam.id}`}
                              >
                                {exam.registrationOpen ? (
                                  <Eye className="h-3 w-3 sm:h-4 sm:w-4 text-green-600" />
                                ) : (
                                  <EyeOff className="h-3 w-3 sm:h-4 sm:w-4 text-gray-400" />
                                )}
                              </Button>
                              <Button
                                onClick={() => {
                                  setEditingExam(exam);
                                  setIsExamFormOpen(true);
                                }}
                                size="sm"
                                variant="outline"
                                className="p-1 h-8 w-8"
                              >
                                <Edit className="h-3 w-3 sm:h-4 sm:w-4" />
                              </Button>
                              <Button
                                onClick={() => {
                                  if (window.confirm('¿Está seguro de que desea eliminar esta mesa de examen?')) {
                                    deleteExamMutation.mutate(exam.id);
                                  }
                                }}
                                size="sm"
                                variant="outline"
                                className="text-red-600 hover:text-red-700 p-1 h-8 w-8"
                              >
                                <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {filteredExamSchedules.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No hay mesas de examen que coincidan con los filtros aplicados
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Exam Calls Management Tab */}
          <TabsContent value="exam-calls" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Llamados de Examen</span>
                  <Button onClick={() => setIsExamCallFormOpen(true)} size="sm" data-testid="button-new-exam-call">
                    <Plus className="h-4 w-4 mr-2" />
                    Nuevo Llamado
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-6">
                  Administre los llamados de examen. Solo un llamado puede estar activo a la vez. 
                  Las mesas de examen se agrupan automáticamente según su fecha dentro del período del llamado.
                </p>

                {activeExamCall && (
                  <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2 text-green-700">
                      <span className="font-semibold">Llamado Activo:</span>
                      <span>{activeExamCall.name}</span>
                      {activeExamCall.startDate && activeExamCall.endDate && (
                        <span className="text-sm">({activeExamCall.startDate} al {activeExamCall.endDate})</span>
                      )}
                    </div>
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full table-auto">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-left p-3">Nombre</th>
                        <th className="text-left p-3">Fecha Inicio</th>
                        <th className="text-left p-3">Fecha Fin</th>
                        <th className="text-left p-3">Exámenes</th>
                        <th className="text-left p-3">Estado</th>
                        <th className="text-left p-3">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {examCalls.map((call) => {
                        // Count exams belonging to this call (prefer examCallId, fallback to date range)
                        const examCount = examSchedules.filter(exam => {
                          if (exam.examCallId != null) return exam.examCallId === call.id;
                          if (!call.startDate || !call.endDate || !exam.date) return false;
                          return exam.date >= call.startDate && exam.date <= call.endDate;
                        }).length;
                        return (
                          <tr key={call.id} className="border-b hover:bg-gray-50">
                            <td className="p-3 font-medium">{call.name}</td>
                            <td className="p-3">{formatDateDDMMYY(call.startDate)}</td>
                            <td className="p-3">{formatDateDDMMYY(call.endDate)}</td>
                            <td className="p-3">{examCount} mesas</td>
                            <td className="p-3">
                              <Badge variant={call.isActive ? "default" : "secondary"}>
                                {call.isActive ? "Activo" : "Inactivo"}
                              </Badge>
                            </td>
                            <td className="p-3">
                              <div className="flex gap-2 flex-wrap">
                                {!call.isActive && (
                                  <Button
                                    onClick={() => {
                                      if (window.confirm(`¿Desea activar el llamado "${call.name}"? Esto desactivará el llamado actual.`)) {
                                        activateExamCallMutation.mutate(call.id);
                                      }
                                    }}
                                    size="sm"
                                    variant="outline"
                                    disabled={activateExamCallMutation.isPending}
                                    data-testid={`button-activate-call-${call.id}`}
                                  >
                                    Activar
                                  </Button>
                                )}
                                <Button
                                  onClick={() => {
                                    setEditingExamCall(call);
                                    setIsEditExamCallFormOpen(true);
                                  }}
                                  size="sm"
                                  variant="outline"
                                  data-testid={`button-edit-call-${call.id}`}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  onClick={() => {
                                    setCloningExamCall(call);
                                    setCloneExamCallName(`${call.name} (Copia)`);
                                    setCloneExamCallStartDate("");
                                    setCloneExamCallEndDate("");
                                    setIsCloneExamCallFormOpen(true);
                                  }}
                                  size="sm"
                                  variant="outline"
                                  data-testid={`button-clone-call-${call.id}`}
                                  title="Clonar llamado con sus mesas"
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                                {!call.isActive && (
                                  <Button
                                    onClick={() => {
                                      if (window.confirm(`¿Está seguro de eliminar el llamado "${call.name}"? Esta acción no se puede deshacer.`)) {
                                        deleteExamCallMutation.mutate(call.id);
                                      }
                                    }}
                                    size="sm"
                                    variant="outline"
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                    disabled={deleteExamCallMutation.isPending}
                                    data-testid={`button-delete-call-${call.id}`}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {examCalls.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No hay llamados de examen registrados
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Subjects (Materias) Tab */}
          <TabsContent value="subjects" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center justify-between gap-3">
                  <span>Catálogo de Materias</span>
                  <Button type="button" size="sm" data-testid="button-add-subject" onClick={() => {
                    setSubjectFormSource("catalog");
                    setNewSubjectName("");
                    setNewSubjectProfesorado(subjectFilterProfesorado === "all" ? "" : subjectFilterProfesorado);
                    setNewSubjectYear("");
                    setNewSubjectTurno("");
                    setNewSubjectDivision("");
                    setIsSubjectFormOpen(true);
                  }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar Materia
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-6">
                  Administre el catálogo de materias por profesorado y año. Renombre o corrija
                  materias y elimine las que ya no se utilizan. Estos cambios se reflejan en el
                  selector de materias al crear o editar mesas de examen.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                  <div className="flex-1">
                    <Label className="text-sm">Buscar materia</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        value={subjectSearch}
                        onChange={(e) => setSubjectSearch(e.target.value)}
                        placeholder="Nombre de la materia..."
                        className="pl-9"
                        data-testid="input-search-subject"
                      />
                    </div>
                  </div>
                  <div className="w-full sm:w-64">
                    <Label className="text-sm">Profesorado</Label>
                    <Select value={subjectFilterProfesorado} onValueChange={setSubjectFilterProfesorado}>
                      <SelectTrigger data-testid="select-filter-subject-profesorado">
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos los profesorados</SelectItem>
                        <SelectItem value="Educación Inicial">Educación Inicial</SelectItem>
                        <SelectItem value="Educación Primaria">Educación Primaria</SelectItem>
                        <SelectItem value="Biología">Biología</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {(() => {
                  const term = subjectSearch.trim().toLowerCase();
                  const filtered = (allSubjects as any[])
                    .filter((s) => subjectFilterProfesorado === "all" || s.profesorado === subjectFilterProfesorado)
                    .filter((s) => !term || s.name.toLowerCase().includes(term));

                  if (filtered.length === 0) {
                    return (
                      <div className="text-center py-8 text-gray-500">
                        No hay materias que coincidan con los filtros.
                      </div>
                    );
                  }

                  const groups = filtered.reduce((acc: Record<string, any[]>, s) => {
                    const key = s.profesorado;
                    (acc[key] = acc[key] || []).push(s);
                    return acc;
                  }, {});

                  return (
                    <div className="space-y-8">
                      {Object.keys(groups).sort().map((profesorado) => {
                        const list = groups[profesorado]
                          .slice()
                          .sort((a: any, b: any) => a.year - b.year || a.name.localeCompare(b.name));
                        return (
                          <div key={profesorado}>
                            <h3 className="font-semibold text-gray-800 mb-3">{profesorado}</h3>
                            <div className="overflow-x-auto">
                              <table className="w-full table-auto">
                                <thead>
                                  <tr className="border-b bg-gray-50">
                                    <th className="text-left p-3">Materia</th>
                                    <th className="text-left p-3 w-24">Año</th>
                                    <th className="text-right p-3 w-32">Acciones</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {list.map((s: any) => (
                                    <tr key={s.id} className="border-b hover:bg-gray-50" data-testid={`row-subject-${s.id}`}>
                                      <td className="p-3 font-medium">{s.name}</td>
                                      <td className="p-3">{s.year}°</td>
                                      <td className="p-3">
                                        <div className="flex gap-2 justify-end">
                                          <Button
                                            onClick={() => {
                                              setEditingSubject(s);
                                              setEditSubjectName(s.name);
                                              setEditSubjectProfesorado(s.profesorado);
                                              setEditSubjectYear(String(s.year));
                                            }}
                                            size="sm"
                                            variant="outline"
                                            data-testid={`button-edit-subject-${s.id}`}
                                          >
                                            <Pencil className="h-4 w-4" />
                                          </Button>
                                          <Button
                                            onClick={() => handleDeleteSubject(s)}
                                            size="sm"
                                            variant="outline"
                                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                            disabled={deleteSubjectMutation.isPending}
                                            data-testid={`button-delete-subject-${s.id}`}
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </TabsContent>

          {user.role === "superadmin" && (
            <TabsContent value="users" className="space-y-6">
              <AdminUsersPanel
                currentUser={user}
                onCurrentUserUpdated={onUserUpdated}
              />
            </TabsContent>
          )}
        </Tabs>

        <Dialog open={isPasswordFormOpen} onOpenChange={setIsPasswordFormOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Cambiar mi contraseña</DialogTitle>
              <DialogDescription>
                Al guardar se cerrarán las demás sesiones abiertas de su usuario.
              </DialogDescription>
            </DialogHeader>
            <PasswordChangeForm
              onCancel={() => setIsPasswordFormOpen(false)}
              onSuccess={(updatedUser) => {
                onUserUpdated(updatedUser);
                setIsPasswordFormOpen(false);
              }}
            />
          </DialogContent>
        </Dialog>

        {/* Exam Form Modal */}
        <Dialog open={isExamFormOpen} onOpenChange={setIsExamFormOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingExam ? "Editar Mesa de Examen" : "Nueva Mesa de Examen"}
              </DialogTitle>
              <DialogDescription>
                {editingExam 
                  ? "Modifique los datos de la mesa de examen seleccionada."
                  : "Complete los datos para crear una nueva mesa de examen."
                }
              </DialogDescription>
            </DialogHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Row 1: Profesorado - Turno */}
                  <FormField
                    control={form.control}
                    name="profesorado"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Profesorado</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar profesorado" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Educación Inicial">Educación Inicial</SelectItem>
                            <SelectItem value="Educación Primaria">Educación Primaria</SelectItem>
                            <SelectItem value="Biología">Biología</SelectItem>
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
                        <FormLabel>Turno</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar turno" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="mañana">Mañana</SelectItem>
                            <SelectItem value="siesta">Siesta</SelectItem>
                            <SelectItem value="tarde">Tarde</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Row 2: Año - División */}
                  <FormField
                    control={form.control}
                    name="year"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Año</FormLabel>
                        <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value?.toString()}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar año" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="1">1° año</SelectItem>
                            <SelectItem value="2">2° año</SelectItem>
                            <SelectItem value="3">3° año</SelectItem>
                            <SelectItem value="4">4° año</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="division"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>División</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar división" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="A">División A</SelectItem>
                            <SelectItem value="B">División B</SelectItem>
                            <SelectItem value="C">División C</SelectItem>
                            <SelectItem value="D">División D</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Row 3: Materia - Fecha */}
                  <FormField
                    control={form.control}
                    name="subject"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Materia</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          value={field.value}
                          disabled={!form.watch("profesorado")}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={
                                !form.watch("profesorado") 
                                  ? "Seleccione primero el profesorado" 
                                  : "Seleccionar materia"
                              } />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {allSubjects
                              .filter(subject => subject.profesorado === form.watch("profesorado"))
                              .sort((a, b) => a.name.localeCompare(b.name))
                              .map((subject) => (
                                <SelectItem key={subject.id} value={subject.name}>
                                  {subject.name} ({subject.year}° año)
                                </SelectItem>
                              ))
                            }
                          </SelectContent>
                        </Select>
                        <FormMessage />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="mt-1 h-auto p-0 text-xs text-primary hover:text-primary/80"
                          onClick={() => {
                            setSubjectFormSource("exam");
                            setNewSubjectName("");
                            setNewSubjectProfesorado(form.getValues("profesorado") || "");
                            setNewSubjectYear(form.getValues("year")?.toString() || "");
                            setNewSubjectTurno(form.getValues("turno") || "");
                            setNewSubjectDivision(form.getValues("division") || "");
                            setIsSubjectFormOpen(true);
                          }}
                        >
                          <Plus className="mr-1 h-3 w-3" />
                          ¿No está la materia? Crear materia nueva
                        </Button>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fecha</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Row 4: Hora - Docente */}
                  <FormField
                    control={form.control}
                    name="time"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Hora</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="teacher"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Docente</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar docente" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {teachers.map((teacher: any) => (
                              <SelectItem key={teacher.id} value={teacher.fullName}>
                                {teacher.fullName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Row 5: Presidente - Vocal 1° */}
                  <FormField
                    control={form.control}
                    name="presidente"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Presidente</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar presidente" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {teachers.map((teacher: any) => (
                              <SelectItem key={teacher.id} value={teacher.fullName}>
                                {teacher.fullName}
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
                    name="vocal1"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vocal 1°</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar vocal 1°" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {teachers.map((teacher: any) => (
                              <SelectItem key={teacher.id} value={teacher.fullName}>
                                {teacher.fullName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Row 6: Vocal 2° - Vocal Suplente */}
                  <FormField
                    control={form.control}
                    name="vocal2"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vocal 2°</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar vocal 2°" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {teachers.map((teacher: any) => (
                              <SelectItem key={teacher.id} value={teacher.fullName}>
                                {teacher.fullName}
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
                    name="vocalSuplente"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vocal Suplente</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar vocal suplente" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {teachers.map((teacher: any) => (
                              <SelectItem key={teacher.id} value={teacher.fullName}>
                                {teacher.fullName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
                      setIsExamFormOpen(false);
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
                    {createExamMutation.isPending || updateExamMutation.isPending
                      ? "Guardando..."
                      : editingExam
                      ? "Actualizar Mesa"
                      : "Crear Mesa"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Create Subject (Materia) Modal */}
        <Dialog open={isSubjectFormOpen} onOpenChange={setIsSubjectFormOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Crear materia nueva</DialogTitle>
              <DialogDescription>
                La materia quedará disponible para el profesorado y año elegidos, en cualquier turno y división.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nombre de la materia</Label>
                <Input
                  value={newSubjectName}
                  onChange={(e) => setNewSubjectName(e.target.value)}
                  placeholder="Ej: Filosofía"
                />
              </div>

              <div className="space-y-2">
                <Label>Profesorado</Label>
                <Select
                  value={newSubjectProfesorado}
                  onValueChange={setNewSubjectProfesorado}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar profesorado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Educación Inicial">Educación Inicial</SelectItem>
                    <SelectItem value="Educación Primaria">Educación Primaria</SelectItem>
                    <SelectItem value="Biología">Biología</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Año</Label>
                  <Select
                    value={newSubjectYear}
                    onValueChange={setNewSubjectYear}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Año" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1° año</SelectItem>
                      <SelectItem value="2">2° año</SelectItem>
                      <SelectItem value="3">3° año</SelectItem>
                      <SelectItem value="4">4° año</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {subjectFormSource === "exam" && <div className="space-y-2">
                  <Label>Turno</Label>
                  <Select value={newSubjectTurno} onValueChange={setNewSubjectTurno}>
                    <SelectTrigger>
                      <SelectValue placeholder="Turno" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mañana">Mañana</SelectItem>
                      <SelectItem value="siesta">Siesta</SelectItem>
                      <SelectItem value="tarde">Tarde</SelectItem>
                    </SelectContent>
                  </Select>
                </div>}
              </div>

              {subjectFormSource === "exam" && <><div className="space-y-2">
                <Label>División</Label>
                <Select value={newSubjectDivision} onValueChange={setNewSubjectDivision}>
                  <SelectTrigger>
                    <SelectValue placeholder="División" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A">División A</SelectItem>
                    <SelectItem value="B">División B</SelectItem>
                    <SelectItem value="C">División C</SelectItem>
                    <SelectItem value="D">División D</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <p className="text-xs text-muted-foreground">
                El turno y la división se aplican solo a esta mesa, no se guardan en la materia.
              </p></>}

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsSubjectFormOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  disabled={createSubjectMutation.isPending}
                  onClick={() => {
                    const name = newSubjectName.trim();
                    const profesorado = newSubjectProfesorado;
                    const year = Number(newSubjectYear);
                    if (!name) {
                      toast({ title: "Ingresá el nombre de la materia", variant: "destructive" });
                      return;
                    }
                    if (!profesorado) {
                      toast({ title: "Seleccioná el profesorado", variant: "destructive" });
                      return;
                    }
                    if (!year) {
                      toast({ title: "Seleccioná el año", variant: "destructive" });
                      return;
                    }
                    createSubjectMutation.mutate({ name, profesorado, year });
                  }}
                >
                  {createSubjectMutation.isPending ? "Guardando..." : "Crear materia"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Subject (Materia) Modal */}
        <Dialog open={editingSubject !== null} onOpenChange={(open) => { if (!open) setEditingSubject(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Editar materia</DialogTitle>
              <DialogDescription>
                Renombre la materia o cambie su profesorado/año. Las mesas de examen asociadas se actualizarán automáticamente.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nombre de la materia</Label>
                <Input
                  value={editSubjectName}
                  onChange={(e) => setEditSubjectName(e.target.value)}
                  placeholder="Ej: Filosofía"
                  data-testid="input-edit-subject-name"
                />
              </div>

              <div className="space-y-2">
                <Label>Profesorado</Label>
                <Select value={editSubjectProfesorado} onValueChange={setEditSubjectProfesorado}>
                  <SelectTrigger data-testid="select-edit-subject-profesorado">
                    <SelectValue placeholder="Seleccionar profesorado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Educación Inicial">Educación Inicial</SelectItem>
                    <SelectItem value="Educación Primaria">Educación Primaria</SelectItem>
                    <SelectItem value="Biología">Biología</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Año</Label>
                <Select value={editSubjectYear} onValueChange={setEditSubjectYear}>
                  <SelectTrigger data-testid="select-edit-subject-year">
                    <SelectValue placeholder="Año" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1° año</SelectItem>
                    <SelectItem value="2">2° año</SelectItem>
                    <SelectItem value="3">3° año</SelectItem>
                    <SelectItem value="4">4° año</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setEditingSubject(null)}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  disabled={updateSubjectMutation.isPending}
                  data-testid="button-save-subject"
                  onClick={() => {
                    if (!editingSubject) return;
                    const name = editSubjectName.trim();
                    const year = parseInt(editSubjectYear);
                    if (!name) {
                      toast({ title: "Ingresá el nombre de la materia", variant: "destructive" });
                      return;
                    }
                    if (!editSubjectProfesorado) {
                      toast({ title: "Seleccioná el profesorado", variant: "destructive" });
                      return;
                    }
                    if (!year) {
                      toast({ title: "Seleccioná el año", variant: "destructive" });
                      return;
                    }
                    updateSubjectMutation.mutate({
                      id: editingSubject.id,
                      data: { name, profesorado: editSubjectProfesorado, year },
                    });
                  }}
                >
                  {updateSubjectMutation.isPending ? "Guardando..." : "Guardar cambios"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Inscription Edit Modal */}
        <Dialog open={isInscriptionFormOpen} onOpenChange={setIsInscriptionFormOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar Inscripción</DialogTitle>
              <DialogDescription>
                Modifique los datos de la inscripción del estudiante.
              </DialogDescription>
            </DialogHeader>
            
            <Form {...inscriptionForm}>
              <form onSubmit={inscriptionForm.handleSubmit((data) => {
                if (editingInscription) {
                  updateInscriptionMutation.mutate({
                    id: editingInscription.id,
                    data: {
                      ...data,
                      examScheduleIds: data.selectedExams
                    }
                  });
                }
              })} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Apellidos */}
                  <FormField
                    control={inscriptionForm.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Apellidos</FormLabel>
                        <FormControl>
                          <Input placeholder="Apellidos del estudiante" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Nombres */}
                  <FormField
                    control={inscriptionForm.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombres</FormLabel>
                        <FormControl>
                          <Input placeholder="Nombres del estudiante" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* DNI */}
                  <FormField
                    control={inscriptionForm.control}
                    name="dni"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>DNI</FormLabel>
                        <FormControl>
                          <Input placeholder="Número de DNI" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Teléfono */}
                  <FormField
                    control={inscriptionForm.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Teléfono</FormLabel>
                        <FormControl>
                          <Input placeholder="Número de teléfono" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Email */}
                  <FormField
                    control={inscriptionForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="Correo electrónico" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Profesorado */}
                  <FormField
                    control={inscriptionForm.control}
                    name="profesorado"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Profesorado</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar profesorado" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Educación Inicial">Educación Inicial</SelectItem>
                            <SelectItem value="Educación Primaria">Educación Primaria</SelectItem>
                            <SelectItem value="Biología">Biología</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Turno */}
                  <FormField
                    control={inscriptionForm.control}
                    name="turno"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Turno</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar turno" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="mañana">Mañana</SelectItem>
                            <SelectItem value="siesta">Siesta</SelectItem>
                            <SelectItem value="tarde">Tarde</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Año */}
                  <FormField
                    control={inscriptionForm.control}
                    name="year"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Año</FormLabel>
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

                  {/* División */}
                  <FormField
                    control={inscriptionForm.control}
                    name="division"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>División</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar división" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="A">División A</SelectItem>
                            <SelectItem value="B">División B</SelectItem>
                            <SelectItem value="C">División C</SelectItem>
                            <SelectItem value="D">División D</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Subject Selection */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Selección de Materias</Label>
                    <div className="flex gap-2">
                      {/* Profesorado Filter */}
                      <Select value={inscriptionFilterProfesorado} onValueChange={setInscriptionFilterProfesorado}>
                        <SelectTrigger className="w-48">
                          <SelectValue placeholder="Filtrar por profesorado" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos los profesorados</SelectItem>
                          <SelectItem value="Educación Inicial">Educación Inicial</SelectItem>
                          <SelectItem value="Educación Primaria">Educación Primaria</SelectItem>
                          <SelectItem value="Biología">Biología</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      {/* Turno Filter */}
                      <Select value={inscriptionFilterTurno} onValueChange={setInscriptionFilterTurno}>
                        <SelectTrigger className="w-40">
                          <SelectValue placeholder="Filtrar por turno" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos los turnos</SelectItem>
                          <SelectItem value="mañana">Mañana</SelectItem>
                          <SelectItem value="siesta">Siesta</SelectItem>
                          <SelectItem value="tarde">Tarde</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  {/* Available Exams */}
                  <div className="space-y-2">
                    <h4 className="font-medium">Materias Disponibles ({availableExamsForInscription.length})</h4>
                    <div className="max-h-48 overflow-y-auto border rounded-lg p-4 space-y-2">
                      {availableExamsForInscription.map((exam) => {
                        const isSelected = inscriptionForm.watch("selectedExams")?.includes(exam.id);
                        return (
                          <div key={exam.id} className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id={`exam-${exam.id}`}
                              checked={isSelected}
                              onChange={(e) => {
                                const current = inscriptionForm.watch("selectedExams") || [];
                                if (e.target.checked) {
                                  inscriptionForm.setValue("selectedExams", [...current, exam.id]);
                                } else {
                                  inscriptionForm.setValue("selectedExams", current.filter((id: number) => id !== exam.id));
                                }
                              }}
                              className="h-4 w-4 text-blue-600 rounded border-gray-300"
                            />
                            <label htmlFor={`exam-${exam.id}`} className="flex-1 text-sm">
                              <div className="font-medium">{exam.subject} - {exam.year}° Año - División {exam.division}</div>
                              <div className="text-gray-600">
                                <span className="font-medium">{exam.profesorado}</span> | <span className="capitalize">{exam.turno}</span> | {formatDateDDMMYY(exam.date)} - {exam.time}
                              </div>
                              <div className="text-gray-500 text-xs">Docente: {exam.teacher}</div>
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Selected Exams Summary */}
                  <div className="space-y-2">
                    <h4 className="font-medium">Materias Seleccionadas ({inscriptionForm.watch("selectedExams")?.length || 0})</h4>
                    <div className="border rounded-lg p-4 space-y-2 bg-blue-50">
                      {inscriptionForm.watch("selectedExams")?.map((examId: number) => {
                        const exam = availableExamsForInscription.find((e) => e.id === examId);
                        if (!exam) return null;
                        return (
                          <div key={exam.id} className="flex items-center justify-between p-2 bg-white rounded">
                            <div>
                              <p className="font-medium">{exam.subject} - {exam.year}° Año - División {exam.division}</p>
                              <p className="text-sm text-gray-600">
                                <span className="font-medium">{exam.profesorado}</span> | <span className="capitalize">{exam.turno}</span> | {formatDateDDMMYY(exam.date)} - {exam.time}
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const current = inscriptionForm.watch("selectedExams") || [];
                                inscriptionForm.setValue("selectedExams", current.filter((id: number) => id !== examId));
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        );
                      })}
                      {(!inscriptionForm.watch("selectedExams") || inscriptionForm.watch("selectedExams").length === 0) && (
                        <p className="text-gray-500 text-sm">No hay materias seleccionadas</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsInscriptionFormOpen(false);
                      setEditingInscription(null);
                      inscriptionForm.reset();
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={updateInscriptionMutation.isPending}
                  >
                    {updateInscriptionMutation.isPending
                      ? "Guardando..."
                      : "Actualizar Inscripción"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Teacher Form Modal */}
        <Dialog open={isTeacherFormOpen} onOpenChange={setIsTeacherFormOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Nuevo Docente</DialogTitle>
              <DialogDescription>
                Complete los datos del docente a agregar.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="teacher-lastName">Apellido *</Label>
                <Input
                  id="teacher-lastName"
                  placeholder="Apellido del docente"
                  value={newTeacherLastName}
                  onChange={(e) => setNewTeacherLastName(e.target.value)}
                  data-testid="input-teacher-lastname"
                />
              </div>
              
              <div>
                <Label htmlFor="teacher-firstName">Nombre *</Label>
                <Input
                  id="teacher-firstName"
                  placeholder="Nombre del docente"
                  value={newTeacherFirstName}
                  onChange={(e) => setNewTeacherFirstName(e.target.value)}
                  data-testid="input-teacher-firstname"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsTeacherFormOpen(false);
                    setNewTeacherFirstName("");
                    setNewTeacherLastName("");
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={() => {
                    if (!newTeacherFirstName.trim() || !newTeacherLastName.trim()) {
                      toast({
                        title: "Error",
                        description: "Por favor complete todos los campos",
                        variant: "destructive",
                      });
                      return;
                    }
                    
                    const fullName = `${newTeacherLastName}, ${newTeacherFirstName}`;
                    createTeacherMutation.mutate({
                      firstName: newTeacherFirstName.trim(),
                      lastName: newTeacherLastName.trim(),
                      fullName: fullName,
                    });
                  }}
                  disabled={createTeacherMutation.isPending}
                  data-testid="button-save-teacher"
                >
                  {createTeacherMutation.isPending ? "Guardando..." : "Crear Docente"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Exam Call Form Modal */}
        <Dialog open={isExamCallFormOpen} onOpenChange={setIsExamCallFormOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Nuevo Llamado de Examen</DialogTitle>
              <DialogDescription>
                Defina el nombre y período del llamado. Las mesas de examen cuyas fechas estén dentro de este período se agruparán automáticamente.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="examCall-name">Nombre del Llamado *</Label>
                <Input
                  id="examCall-name"
                  placeholder="Ej: Primer Llamado - Febrero 2026"
                  value={newExamCallName}
                  onChange={(e) => setNewExamCallName(e.target.value)}
                  data-testid="input-exam-call-name"
                />
              </div>
              
              <div>
                <Label htmlFor="examCall-startDate">Fecha de Inicio *</Label>
                <Input
                  id="examCall-startDate"
                  type="date"
                  value={newExamCallStartDate}
                  onChange={(e) => setNewExamCallStartDate(e.target.value)}
                  data-testid="input-exam-call-start-date"
                />
              </div>
              
              <div>
                <Label htmlFor="examCall-endDate">Fecha de Fin *</Label>
                <Input
                  id="examCall-endDate"
                  type="date"
                  value={newExamCallEndDate}
                  onChange={(e) => setNewExamCallEndDate(e.target.value)}
                  data-testid="input-exam-call-end-date"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsExamCallFormOpen(false);
                    setNewExamCallName("");
                    setNewExamCallStartDate("");
                    setNewExamCallEndDate("");
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={() => {
                    if (!newExamCallName.trim() || !newExamCallStartDate || !newExamCallEndDate) {
                      toast({
                        title: "Error",
                        description: "Por favor complete todos los campos",
                        variant: "destructive",
                      });
                      return;
                    }
                    
                    if (newExamCallStartDate > newExamCallEndDate) {
                      toast({
                        title: "Error",
                        description: "La fecha de inicio debe ser anterior a la fecha de fin",
                        variant: "destructive",
                      });
                      return;
                    }
                    
                    createExamCallMutation.mutate({
                      name: newExamCallName.trim(),
                      startDate: newExamCallStartDate,
                      endDate: newExamCallEndDate,
                    });
                  }}
                  disabled={createExamCallMutation.isPending}
                  data-testid="button-save-exam-call"
                >
                  {createExamCallMutation.isPending ? "Guardando..." : "Crear Llamado"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Exam Call Modal */}
        <Dialog open={isEditExamCallFormOpen} onOpenChange={(open) => {
          setIsEditExamCallFormOpen(open);
          if (!open) setEditingExamCall(null);
        }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Editar Llamado de Examen</DialogTitle>
              <DialogDescription>
                Modifique el nombre y período del llamado.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-examCall-name">Nombre del Llamado *</Label>
                <Input
                  id="edit-examCall-name"
                  placeholder="Ej: Primer Llamado - Febrero 2026"
                  value={editingExamCall?.name || ""}
                  onChange={(e) => setEditingExamCall(prev => prev ? {...prev, name: e.target.value} : null)}
                  data-testid="input-edit-exam-call-name"
                />
              </div>
              
              <div>
                <Label htmlFor="edit-examCall-startDate">Fecha de Inicio *</Label>
                <Input
                  id="edit-examCall-startDate"
                  type="date"
                  value={editingExamCall?.startDate || ""}
                  onChange={(e) => setEditingExamCall(prev => prev ? {...prev, startDate: e.target.value} : null)}
                  data-testid="input-edit-exam-call-start-date"
                />
              </div>
              
              <div>
                <Label htmlFor="edit-examCall-endDate">Fecha de Fin *</Label>
                <Input
                  id="edit-examCall-endDate"
                  type="date"
                  value={editingExamCall?.endDate || ""}
                  onChange={(e) => setEditingExamCall(prev => prev ? {...prev, endDate: e.target.value} : null)}
                  data-testid="input-edit-exam-call-end-date"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditExamCallFormOpen(false);
                    setEditingExamCall(null);
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={() => {
                    if (!editingExamCall) return;
                    if (!editingExamCall.name?.trim() || !editingExamCall.startDate || !editingExamCall.endDate) {
                      toast({
                        title: "Error",
                        description: "Por favor complete todos los campos",
                        variant: "destructive",
                      });
                      return;
                    }
                    
                    if (editingExamCall.startDate > editingExamCall.endDate) {
                      toast({
                        title: "Error",
                        description: "La fecha de inicio debe ser anterior a la fecha de fin",
                        variant: "destructive",
                      });
                      return;
                    }
                    
                    updateExamCallMutation.mutate({
                      id: editingExamCall.id,
                      data: {
                        name: editingExamCall.name.trim(),
                        startDate: editingExamCall.startDate,
                        endDate: editingExamCall.endDate,
                      },
                    });
                  }}
                  disabled={updateExamCallMutation.isPending}
                  data-testid="button-save-edit-exam-call"
                >
                  {updateExamCallMutation.isPending ? "Guardando..." : "Guardar Cambios"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Clone Exam Call Modal */}
        <Dialog open={isCloneExamCallFormOpen} onOpenChange={(open) => {
          setIsCloneExamCallFormOpen(open);
          if (!open) {
            setCloningExamCall(null);
            setCloneExamCallName("");
            setCloneExamCallStartDate("");
            setCloneExamCallEndDate("");
          }
        }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Clonar Llamado de Examen</DialogTitle>
              <DialogDescription>
                Cree un nuevo llamado con todas las mesas del llamado "{cloningExamCall?.name}". 
                Las mesas se crearán con la fecha de inicio del nuevo período.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
                Se clonarán las mesas cuyas fechas estén entre {cloningExamCall?.startDate} y {cloningExamCall?.endDate}
              </div>

              <div>
                <Label htmlFor="clone-examCall-name">Nombre del Nuevo Llamado *</Label>
                <Input
                  id="clone-examCall-name"
                  placeholder="Ej: Segundo Llamado - Marzo 2026"
                  value={cloneExamCallName}
                  onChange={(e) => setCloneExamCallName(e.target.value)}
                  data-testid="input-clone-exam-call-name"
                />
              </div>
              
              <div>
                <Label htmlFor="clone-examCall-startDate">Fecha de Inicio *</Label>
                <Input
                  id="clone-examCall-startDate"
                  type="date"
                  value={cloneExamCallStartDate}
                  onChange={(e) => setCloneExamCallStartDate(e.target.value)}
                  data-testid="input-clone-exam-call-start-date"
                />
              </div>
              
              <div>
                <Label htmlFor="clone-examCall-endDate">Fecha de Fin *</Label>
                <Input
                  id="clone-examCall-endDate"
                  type="date"
                  value={cloneExamCallEndDate}
                  onChange={(e) => setCloneExamCallEndDate(e.target.value)}
                  data-testid="input-clone-exam-call-end-date"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsCloneExamCallFormOpen(false);
                    setCloningExamCall(null);
                    setCloneExamCallName("");
                    setCloneExamCallStartDate("");
                    setCloneExamCallEndDate("");
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={() => {
                    if (!cloningExamCall) return;
                    if (!cloneExamCallName.trim() || !cloneExamCallStartDate || !cloneExamCallEndDate) {
                      toast({
                        title: "Error",
                        description: "Por favor complete todos los campos",
                        variant: "destructive",
                      });
                      return;
                    }
                    
                    if (cloneExamCallStartDate > cloneExamCallEndDate) {
                      toast({
                        title: "Error",
                        description: "La fecha de inicio debe ser anterior a la fecha de fin",
                        variant: "destructive",
                      });
                      return;
                    }
                    
                    cloneExamCallMutation.mutate({
                      id: cloningExamCall.id,
                      data: {
                        name: cloneExamCallName.trim(),
                        startDate: cloneExamCallStartDate,
                        endDate: cloneExamCallEndDate,
                      },
                    });
                  }}
                  disabled={cloneExamCallMutation.isPending}
                  data-testid="button-clone-exam-call"
                >
                  {cloneExamCallMutation.isPending ? "Clonando..." : "Clonar Llamado"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
