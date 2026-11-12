import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, X, CheckCircle, Clock, XCircle, CalendarDays, Download } from "lucide-react";
import { formatDateDDMMYY } from "@/lib/utils";
import type { Student, Inscription, ExamSchedule, ExamCall } from "@shared/schema";

interface InscriptionDetail {
  inscription: Inscription;
  examSchedules: ExamSchedule[];
  examCall: ExamCall | null;
}

interface InscriptionStatusResponse {
  student: Student;
  inscriptions: InscriptionDetail[];
}

export default function InscriptionStatusChecker() {
  const [dni, setDni] = useState("");
  const [searchDni, setSearchDni] = useState("");
  const [showSearchDialog, setShowSearchDialog] = useState(false);
  const [showResult, setShowResult] = useState(false);

  const { data: inscriptionData, isLoading, error } = useQuery<InscriptionStatusResponse>({
    queryKey: [`/api/inscriptions/status/${searchDni}`],
    enabled: !!searchDni && searchDni.length >= 7,
    retry: false,
  });

  const handleSearch = () => {
    if (dni.length >= 7) {
      setSearchDni(dni);
      setShowResult(true);
    }
  };

  const handleClose = () => {
    setShowResult(false);
    setShowSearchDialog(false);
    setSearchDni("");
    setDni("");
  };

  const handleOpenSearch = () => {
    setShowSearchDialog(true);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "confirmed":
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case "pending":
        return <Clock className="w-5 h-5 text-gray-600" />;
      case "rejected":
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return <Clock className="w-5 h-5 text-gray-600" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "confirmed":
        return "Confirmado";
      case "pending":
        return "Pendiente";
      case "rejected":
        return "Rechazado";
      default:
        return "Pendiente";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed":
        return "bg-green-100 text-green-800 border-green-200";
      case "pending":
        return "bg-gray-100 text-gray-800 border-gray-200";
      case "rejected":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  return (
    <>
      <button
        onClick={handleOpenSearch}
        className="text-white hover:text-blue-200 text-sm flex items-center transition-colors"
      >
        <Search className="w-4 h-4 mr-1" />
        Estado de Inscripción
      </button>

      {showSearchDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg flex items-center">
                <Search className="w-5 h-5 mr-2" />
                Estado de Inscripción
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClose}
                className="h-6 w-6 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="dniSearch">
                    Ingrese su DNI para verificar el estado de su inscripción
                  </Label>
                  <Input
                    id="dniSearch"
                    value={dni}
                    onChange={(e) => setDni(e.target.value)}
                    placeholder="Ej: 12345678"
                    className="mt-1"
                    maxLength={8}
                  />
                </div>
                <Button 
                  onClick={handleSearch}
                  disabled={dni.length < 7 || isLoading}
                  className="w-full"
                >
                  {isLoading ? "Buscando..." : "Buscar"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {showResult && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg">Estado de Inscripción</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClose}
                className="h-6 w-6 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8">
                  <div className="animate-pulse">
                    <Search className="w-8 h-8 mx-auto text-gray-500 mb-2" />
                    <p>Buscando inscripción...</p>
                  </div>
                </div>
              ) : error || !inscriptionData ? (
                <div className="text-center py-8">
                  <XCircle className="w-12 h-12 mx-auto text-red-500 mb-4" />
                  <h3 className="font-semibold text-lg mb-2">Sin resultados</h3>
                  <p className="text-gray-600 mb-4">
                    No hay inscripción registrada con ese DNI.
                  </p>
                  <p className="text-sm text-gray-500">
                    Si esto es un error, por favor diríjase a Bedelía.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="border-b pb-4">
                    <h3 className="font-semibold mb-2">Datos del Estudiante</h3>
                    <p><strong>Nombre:</strong> {inscriptionData.student.lastName}, {inscriptionData.student.firstName}</p>
                    <p><strong>DNI:</strong> {inscriptionData.student.dni}</p>
                    <p><strong>Profesorado:</strong> {inscriptionData.student.profesorado}</p>
                    <p><strong>Turno:</strong> {inscriptionData.student.turno ? inscriptionData.student.turno.charAt(0).toUpperCase() + inscriptionData.student.turno.slice(1) : "No especificado"}</p>
                  </div>

                  {inscriptionData.inscriptions.map((detail, index) => (
                    <div key={detail.inscription.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center gap-2 border-b pb-2">
                        <CalendarDays className="w-5 h-5 text-blue-600" />
                        <h3 className="font-semibold text-blue-800">
                          {detail.examCall ? detail.examCall.name : "Llamado no especificado"}
                        </h3>
                      </div>

                      {detail.examCall && detail.examCall.startDate && detail.examCall.endDate && (
                        <p className="text-xs text-gray-500">
                          Período: {formatDateDDMMYY(detail.examCall.startDate)} al {formatDateDDMMYY(detail.examCall.endDate)}
                        </p>
                      )}

                      <div className="text-center py-2">
                        <div className={`inline-flex items-center px-4 py-2 rounded-full border font-semibold text-sm ${getStatusColor(detail.inscription.status || "pending")}`}>
                          {getStatusIcon(detail.inscription.status || "pending")}
                          <span className="ml-2">Estado: {getStatusText(detail.inscription.status || "pending")}</span>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-medium mb-2 text-sm">Materias Inscriptas</h4>
                        <div className="space-y-2">
                          {detail.examSchedules.map((exam) => (
                            <div key={exam.id} className="p-3 bg-gray-50 rounded border">
                              <p className="font-medium">{exam.subject} - {exam.year}° Año</p>
                              <p className="text-sm text-gray-600">
                                Fecha: {formatDateDDMMYY(exam.date)} | Hora: {exam.time}
                              </p>
                              <p className="text-xs text-gray-500">
                                Mesa: {exam.presidente || "Sin asignar"} (Presidente), {exam.vocal1 || "Sin asignar"}, {exam.vocal2 || "Sin asignar"}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {detail.inscription.status === "pending" && (
                        <div className="bg-yellow-50 border border-yellow-200 p-3 rounded">
                          <p className="text-sm text-yellow-800">
                            <strong>Inscripción Pendiente:</strong> Su inscripción está siendo revisada por el personal de Bedelía. 
                            Recibirá confirmación una vez que sea aprobada.
                          </p>
                        </div>
                      )}

                      {detail.inscription.status === "confirmed" && (
                        <div className="bg-green-50 border border-green-200 p-3 rounded space-y-3">
                          <p className="text-sm text-green-800">
                            <strong>Inscripción Confirmada:</strong> Su inscripción ha sido aprobada. 
                            Puede presentarse a rendir en las fechas indicadas. Recuerde que deberá presentar su libreta al retirar el permiso de examen por Bedelía.
                          </p>
                          <Button
                            onClick={async () => {
                              const { generatePermissionSlipPDF } = await import(
                                "@/lib/permission-slip-generator"
                              );
                              generatePermissionSlipPDF(
                                inscriptionData.student,
                                detail.examSchedules,
                                detail.inscription.permissionNumber ?? undefined,
                              );
                            }}
                            className="w-full bg-green-700 hover:bg-green-800 text-white flex items-center justify-center gap-2"
                          >
                            <Download className="w-4 h-4" />
                            Descargar Permiso de Examen
                          </Button>
                        </div>
                      )}

                      {detail.inscription.status === "rejected" && (
                        <div className="bg-red-50 border border-red-200 p-3 rounded">
                          <p className="text-sm text-red-800">
                            <strong>Inscripción Rechazada:</strong> Su inscripción no pudo ser procesada. 
                            Por favor, diríjase a Bedelía para más información.
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
