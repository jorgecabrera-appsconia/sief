import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Users, FileText, Search, GraduationCap } from "lucide-react";
import { formatDateDDMMYY } from "@/lib/utils";

export default function TeachersPage() {
  const [selectedProfesorado, setSelectedProfesorado] = useState("");
  const [selectedTurno, setSelectedTurno] = useState("");
  const [selectedMesa, setSelectedMesa] = useState("");
  const [selectedMateria, setSelectedMateria] = useState("");
  const [selectedTeacher, setSelectedTeacher] = useState("");
  const [showStudents, setShowStudents] = useState(false);
  const [showTeacherMesas, setShowTeacherMesas] = useState(false);

  // Fetch exam schedules
  const { data: examSchedules = [] } = useQuery<any[]>({
    queryKey: ["/api/exam-schedules"],
  });

  const { data: teacherPortal } = useQuery<{
    examSchedule: any;
    students: Array<{
      firstName: string;
      lastName: string;
      condition: "regular" | "libre";
    }>;
  }>({
    queryKey: [`/api/public/teacher-portal?examScheduleId=${selectedMesa}`],
    enabled: Boolean(selectedMesa),
  });

  // Fetch exam calls to find the active one
  const { data: examCalls = [] } = useQuery<any[]>({
    queryKey: ["/api/exam-calls"],
  });

  const activeExamCall = examCalls.find((call: any) => call.isActive) ?? null;

  // Filter exam schedules to only show those belonging to the active llamado.
  // A mesa is included if its examCallId matches OR its date falls within the llamado's period.
  const activeExamSchedules = examSchedules.filter((exam: any) => {
    if (!activeExamCall) return false;

    const matchesById = exam.examCallId != null && exam.examCallId === activeExamCall.id;

    const matchesByDate =
      activeExamCall.startDate &&
      activeExamCall.endDate &&
      exam.date &&
      exam.date >= activeExamCall.startDate &&
      exam.date <= activeExamCall.endDate;

    return matchesById || matchesByDate;
  });

  // Get unique values for filters (only from active llamado mesas)
  const profesorados = Array.from(new Set(activeExamSchedules.map((exam: any) => exam.profesorado)));
  const turnos = Array.from(new Set(activeExamSchedules.map((exam: any) => exam.turno)));
  
  // Filter exams based on selected profesorado and turno
  const filteredExams = activeExamSchedules.filter((exam: any) => {
    return (!selectedProfesorado || exam.profesorado === selectedProfesorado) &&
           (!selectedTurno || exam.turno === selectedTurno);
  });

  const materias = Array.from(new Set(filteredExams.map(exam => exam.subject)));

  // Get mesa options based on selected materia
  const mesaOptions = filteredExams.filter(exam => 
    (!selectedMateria || exam.subject === selectedMateria)
  );

  // Fetch teachers from database - this is the authoritative source
  const { data: teachersFromDB = [] } = useQuery<any[]>({
    queryKey: ["/api/teachers"],
  });

  // Function to normalize teacher names
  const normalizeTeacherName = (name: string): string => {
    return name.trim()
      .split(/\s+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  // Function to create a unique key for teacher comparison
  const createTeacherKey = (name: string): string => {
    const normalized = normalizeTeacherName(name);
    return normalized.replace(/[.,\s]/g, '').toLowerCase();
  };

  const formatDate = (dateString: string): string => formatDateDDMMYY(dateString);

  // Use only database teachers - no fallback to exam schedules which may have typos.
  // Sort alphabetically using Spanish locale so accents and "Ñ" land in the right
  // position, including teachers added manually.
  const teachersList = teachersFromDB
    .map(teacher => normalizeTeacherName(`${teacher.lastName}, ${teacher.firstName}`))
    .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));

  // Get mesas where teacher participates - comparing with normalized names
  const getTeacherMesas = () => {
    if (!selectedTeacher) return [];
    
    const selectedTeacherKey = createTeacherKey(selectedTeacher);
    
    // Only consider mesas from the active llamado (never previous calls).
    return activeExamSchedules.filter((exam: any) => {
      // Compare with normalized versions of exam schedule teacher names
      const presidenteKey = exam.presidente ? createTeacherKey(exam.presidente) : '';
      const vocal1Key = exam.vocal1 ? createTeacherKey(exam.vocal1) : '';
      const vocal2Key = exam.vocal2 ? createTeacherKey(exam.vocal2) : '';
      const vocalSuplenteKey = exam.vocalSuplente ? createTeacherKey(exam.vocalSuplente) : '';
      
      return presidenteKey === selectedTeacherKey ||
             vocal1Key === selectedTeacherKey ||
             vocal2Key === selectedTeacherKey ||
             vocalSuplenteKey === selectedTeacherKey;
    }).map(exam => {
      const presidenteKey = exam.presidente ? createTeacherKey(exam.presidente) : '';
      const vocal1Key = exam.vocal1 ? createTeacherKey(exam.vocal1) : '';
      const vocal2Key = exam.vocal2 ? createTeacherKey(exam.vocal2) : '';
      const vocalSuplenteKey = exam.vocalSuplente ? createTeacherKey(exam.vocalSuplente) : '';
      
      return {
        ...exam,
        role: presidenteKey === selectedTeacherKey ? "Presidente" :
              vocal1Key === selectedTeacherKey ? "Vocal 1°" :
              vocal2Key === selectedTeacherKey ? "Vocal 2°" : "Vocal Suplente"
      };
    });
  };

  const confirmedStudents = teacherPortal?.students ?? [];
  const teacherMesas = getTeacherMesas();

  const handleViewStudents = () => {
    if (selectedMesa) {
      setShowStudents(true);
      setShowTeacherMesas(false);
    }
  };

  const handleViewTeacherMesas = () => {
    if (selectedTeacher) {
      setShowTeacherMesas(true);
      setShowStudents(false);
    }
  };

  const generatePDF = () => {
    if (!selectedMesa) return;
    
    const mesa = activeExamSchedules.find((exam: any) => exam.id === parseInt(selectedMesa));
    if (!mesa) return;

    // For now, we'll use the existing acta volante generator
    // generateTeacherActaPDF({
    //   examSchedule: mesa,
    //   students: confirmedStudents
    // });
    alert("Función de PDF en desarrollo");
  };

  const resetFilters = () => {
    setSelectedProfesorado("");
    setSelectedTurno("");
    setSelectedMesa("");
    setSelectedMateria("");
    setShowStudents(false);
  };

  const resetTeacherSearch = () => {
    setSelectedTeacher("");
    setShowTeacherMesas(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-lg border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center gap-3">
              <GraduationCap className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Portal Docente</h1>
                <p className="text-sm text-gray-600">ISFD "Dr. Pedro Ignacio de Castro Barros"</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Mesa Filter Section */}
          <Card className="shadow-lg">
            <CardHeader className="bg-blue-600 text-white">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Ver Estudiantes por Mesa
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              {activeExamCall ? (
                <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-md text-sm text-green-800">
                  <span className="font-medium">Llamado activo:</span>
                  <span>{activeExamCall.name}</span>
                </div>
              ) : (
                <div className="px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-md text-sm text-yellow-800">
                  No hay ningún llamado activo en este momento.
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Profesorado</Label>
                  <Select value={selectedProfesorado} onValueChange={setSelectedProfesorado}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar profesorado" />
                    </SelectTrigger>
                    <SelectContent>
                      {profesorados.map(prof => (
                        <SelectItem key={prof} value={prof}>{prof}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Turno</Label>
                  <Select value={selectedTurno} onValueChange={setSelectedTurno}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar turno" />
                    </SelectTrigger>
                    <SelectContent>
                      {turnos.map(turno => (
                        <SelectItem key={turno} value={turno}>
                          {turno.charAt(0).toUpperCase() + turno.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Materia</Label>
                  <Select value={selectedMateria} onValueChange={setSelectedMateria}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar materia" />
                    </SelectTrigger>
                    <SelectContent>
                      {materias.map(materia => (
                        <SelectItem key={materia} value={materia}>{materia}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Mesa</Label>
                  <Select value={selectedMesa} onValueChange={setSelectedMesa}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar mesa" />
                    </SelectTrigger>
                    <SelectContent>
                      {mesaOptions.map(exam => (
                        <SelectItem key={exam.id} value={exam.id.toString()}>
                          {exam.subject} - {exam.year}° año - Div. {exam.division} ({formatDate(exam.date)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button 
                  onClick={handleViewStudents}
                  disabled={!selectedMesa}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Users className="h-4 w-4 mr-2" />
                  Ver Inscriptos
                </Button>
                <Button onClick={resetFilters} variant="outline">
                  Limpiar
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Teacher Search Section */}
          <Card className="shadow-lg">
            <CardHeader className="bg-green-600 text-white">
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Buscar Mesas por Docente
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div>
                <Label>Soy docente y quiero saber en qué mesas participo</Label>
                <Select value={selectedTeacher} onValueChange={setSelectedTeacher}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar docente" />
                  </SelectTrigger>
                  <SelectContent>
                    {teachersList.map(teacher => (
                      <SelectItem key={teacher} value={teacher}>{teacher}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2 pt-4">
                <Button 
                  onClick={handleViewTeacherMesas}
                  disabled={!selectedTeacher}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Search className="h-4 w-4 mr-2" />
                  Ver Mis Mesas
                </Button>
                <Button onClick={resetTeacherSearch} variant="outline">
                  Limpiar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Results Section */}
        {(showStudents || showTeacherMesas) && (
          <Card className="mt-8 shadow-lg">
            <CardHeader className="bg-gray-800 text-white">
              <div className="flex justify-between items-center">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  {showStudents ? "Estudiantes Inscriptos" : "Mesas del Docente"}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {showStudents && (
                <div>
                  {/* Mesa Info */}
                  {selectedMesa && (
                    <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {(() => {
                          const mesa = activeExamSchedules.find((exam: any) => exam.id === parseInt(selectedMesa));
                          return mesa ? (
                            <>
                              <div>
                                {activeExamCall && (
                                  <p><strong>Llamado:</strong> {activeExamCall.name}</p>
                                )}
                                <p><strong>Materia:</strong> {mesa.subject}</p>
                                <p><strong>Año:</strong> {mesa.year}°</p>
                                <p><strong>División:</strong> {mesa.division}</p>
                                <p><strong>Profesorado:</strong> {mesa.profesorado}</p>
                              </div>
                              <div>
                                <p><strong>Fecha:</strong> {formatDate(mesa.date)}</p>
                                <p><strong>Hora:</strong> {mesa.time}</p>
                                <p><strong>Turno:</strong> {mesa.turno.charAt(0).toUpperCase() + mesa.turno.slice(1)}</p>
                              </div>
                              <div className="md:col-span-2">
                                <p><strong>Presidente:</strong> {mesa.presidente}</p>
                                <p><strong>Vocales:</strong> {mesa.vocal1}, {mesa.vocal2}</p>
                                <p><strong>Vocal Suplente:</strong> {mesa.vocalSuplente}</p>
                              </div>
                            </>
                          ) : null;
                        })()}
                      </div>
                    </div>
                  )}

                  {/* Students Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full table-auto border-collapse border border-gray-300">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="border border-gray-300 p-3 text-left">N°</th>
                          <th className="border border-gray-300 p-3 text-left">Apellido y Nombre</th>
                          <th className="border border-gray-300 p-3 text-left">Condición</th>
                        </tr>
                      </thead>
                      <tbody>
                        {confirmedStudents.map((student, index) => (
                          <tr key={`${student.lastName}-${student.firstName}-${index}`} className="hover:bg-gray-50">
                            <td className="border border-gray-300 p-3">{index + 1}</td>
                            <td className="border border-gray-300 p-3">
                              {student.lastName}, {student.firstName}
                            </td>
                            <td className="border border-gray-300 p-3 text-center">
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                student.condition === "libre"
                                  ? "bg-orange-100 text-orange-700"
                                  : "bg-green-100 text-green-700"
                              }`}>
                                {student.condition === "libre" ? "Libre" : "Regular"}
                              </span>
                            </td>
                          </tr>
                        ))}
                        {/* Empty rows for manual additions */}
                        {Array.from({ length: 5 }).map((_, index) => (
                          <tr key={`empty-${index}`}>
                            <td className="border border-gray-300 p-3 bg-gray-50">
                              {confirmedStudents.length + index + 1}
                            </td>
                            <td className="border border-gray-300 p-3 bg-gray-50"></td>
                            <td className="border border-gray-300 p-3 bg-gray-50"></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-4 text-sm text-gray-600">
                    <p><strong>Total de estudiantes inscriptos:</strong> {confirmedStudents.length}</p>
                  </div>
                </div>
              )}

              {showTeacherMesas && (
                <div>
                  <h3 className="text-lg font-semibold mb-4">
                    Mesas donde participa: {selectedTeacher}
                  </h3>
                  <div className="grid gap-4">
                    {teacherMesas.map((mesa) => (
                      <div key={mesa.id} className="border rounded-lg p-4 bg-gray-50">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                              <div>
                                <p><strong>Materia:</strong> {mesa.subject}</p>
                                <p><strong>Año:</strong> {mesa.year}°</p>
                              </div>
                              <div>
                                <p><strong>Fecha:</strong> {formatDate(mesa.date)}</p>
                                <p><strong>Hora:</strong> {mesa.time}</p>
                              </div>
                              <div>
                                <p><strong>Profesorado:</strong> {mesa.profesorado}</p>
                                <p><strong>Turno:</strong> {mesa.turno.charAt(0).toUpperCase() + mesa.turno.slice(1)}</p>
                              </div>
                            </div>
                          </div>
                          <Badge 
                            variant={mesa.role === "Presidente" ? "default" : "secondary"}
                            className="ml-4"
                          >
                            {mesa.role}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {teacherMesas.length === 0 && (
                    <p className="text-gray-500 text-center py-8">
                      No se encontraron mesas para este docente.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
