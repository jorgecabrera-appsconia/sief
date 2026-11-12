import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Archive, Calendar, Clock, User } from "lucide-react";
import type { ExamSchedule } from "@shared/schema";

const profesoradoOptions = [
  { value: "educacion-inicial", label: "Educación Inicial" },
  { value: "educacion-primaria", label: "Educación Primaria" },
  { value: "biologia", label: "Biología" }
];

const turnoOptions = [
  { value: "mañana", label: "Mañana" },
  { value: "siesta", label: "Siesta" },
  { value: "tarde", label: "Tarde" }
];

export default function ArchivedExams() {
  const [selectedProfesorado, setSelectedProfesorado] = useState<string>("");
  const [selectedTurno, setSelectedTurno] = useState<string>("");

  const { data: archivedExams = [], isLoading } = useQuery<ExamSchedule[]>({
    queryKey: ["/api/exam-schedules/archived/Julio%202025"],
  });

  const filteredExams = archivedExams.filter(exam => {
    if (selectedProfesorado && selectedProfesorado !== "all" && exam.profesorado !== selectedProfesorado) return false;
    if (selectedTurno && selectedTurno !== "all" && exam.turno !== selectedTurno) return false;
    return true;
  });

  const examsByYear = filteredExams.reduce((acc, exam) => {
    if (!acc[exam.year]) {
      acc[exam.year] = [];
    }
    acc[exam.year].push(exam);
    return acc;
  }, {} as Record<number, ExamSchedule[]>);

  if (isLoading) {
    return (
      <Card data-testid="card-archived-exams">
        <CardHeader className="bg-amber-600 text-white rounded-t-lg">
          <CardTitle className="flex items-center gap-2">
            <Archive className="w-5 h-5" />
            Mesas Julio 2025 (Archivo)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <p className="text-center text-gray-500">Cargando mesas archivadas...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-archived-exams">
      <CardHeader className="bg-amber-600 text-white rounded-t-lg">
        <CardTitle className="flex items-center gap-2">
          <Archive className="w-5 h-5" />
          Mesas Julio 2025 (Archivo)
        </CardTitle>
        <p className="text-sm mt-2 opacity-90">
          Las inscripciones para estas mesas están cerradas. Solo se muestran con fines informativos.
        </p>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Filtrar por Profesorado</label>
            <Select value={selectedProfesorado} onValueChange={setSelectedProfesorado}>
              <SelectTrigger data-testid="select-profesorado-filter">
                <SelectValue placeholder="Todos los profesorados" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los profesorados</SelectItem>
                {profesoradoOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Filtrar por Turno</label>
            <Select value={selectedTurno} onValueChange={setSelectedTurno}>
              <SelectTrigger data-testid="select-turno-filter">
                <SelectValue placeholder="Todos los turnos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los turnos</SelectItem>
                {turnoOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {filteredExams.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Archive className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No hay mesas archivadas para mostrar con los filtros seleccionados.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(examsByYear)
              .sort(([a], [b]) => parseInt(a) - parseInt(b))
              .map(([year, exams]) => (
                <div key={year}>
                  <h3 className="text-lg font-semibold mb-3 text-gray-700" data-testid={`heading-year-${year}`}>
                    {year}° Año
                  </h3>
                  <div className="grid gap-3">
                    {exams.map((exam) => (
                      <div
                        key={exam.id}
                        className="border rounded-lg p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
                        data-testid={`exam-card-${exam.id}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900 mb-2" data-testid={`text-subject-${exam.id}`}>
                              {exam.subject}
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-600">
                              <div className="flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                <span data-testid={`text-date-${exam.id}`}>{exam.date}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                <span data-testid={`text-time-${exam.id}`}>{exam.time}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <User className="w-4 h-4" />
                                <span data-testid={`text-teacher-${exam.id}`}>Docente: {exam.teacher}</span>
                              </div>
                            </div>
                            <div className="mt-2 text-xs text-gray-500">
                              <p>Presidente: {exam.presidente}</p>
                              <p>Vocal 1: {exam.vocal1} | Vocal 2: {exam.vocal2}</p>
                              <p>Vocal Suplente: {exam.vocalSuplente}</p>
                            </div>
                          </div>
                          <Badge variant="secondary" className="bg-amber-100 text-amber-800" data-testid={`badge-closed-${exam.id}`}>
                            Cerrada
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
