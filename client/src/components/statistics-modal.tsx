import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, Users, BookOpen, Clock } from 'lucide-react';

interface StatisticsData {
  profesorado: string;
  turno: string;
  year: number;
  subject: string;
  student_count: number;
  confirmed_count: number;
  pending_count: number;
  rejected_count: number;
}

export function StatisticsModal() {
  const [isOpen, setIsOpen] = useState(false);

  const { data: statisticsData, isLoading } = useQuery<StatisticsData[]>({
    queryKey: ['/api/statistics/inscriptions'],
    enabled: isOpen,
  });

  // Group data by different criteria
  const groupedByProfesorado = statisticsData?.reduce((acc, item) => {
    const key = item.profesorado;
    if (!acc[key]) {
      acc[key] = { total: 0, confirmed: 0, pending: 0, rejected: 0 };
    }
    acc[key].total += Number(item.student_count);
    acc[key].confirmed += Number(item.confirmed_count);
    acc[key].pending += Number(item.pending_count);
    acc[key].rejected += Number(item.rejected_count);
    return acc;
  }, {} as Record<string, { total: number; confirmed: number; pending: number; rejected: number }>);

  const groupedByTurno = statisticsData?.reduce((acc, item) => {
    const key = item.turno;
    if (!acc[key]) {
      acc[key] = { total: 0, confirmed: 0, pending: 0, rejected: 0 };
    }
    acc[key].total += Number(item.student_count);
    acc[key].confirmed += Number(item.confirmed_count);
    acc[key].pending += Number(item.pending_count);
    acc[key].rejected += Number(item.rejected_count);
    return acc;
  }, {} as Record<string, { total: number; confirmed: number; pending: number; rejected: number }>);

  const groupedByYear = statisticsData?.reduce((acc, item) => {
    const key = `${item.year}°`;
    if (!acc[key]) {
      acc[key] = { total: 0, confirmed: 0, pending: 0, rejected: 0 };
    }
    acc[key].total += Number(item.student_count);
    acc[key].confirmed += Number(item.confirmed_count);
    acc[key].pending += Number(item.pending_count);
    acc[key].rejected += Number(item.rejected_count);
    return acc;
  }, {} as Record<string, { total: number; confirmed: number; pending: number; rejected: number }>);

  const topSubjects = statisticsData
    ?.reduce((acc, item) => {
      const key = item.subject;
      if (!acc[key]) {
        acc[key] = { total: 0, confirmed: 0, pending: 0, rejected: 0 };
      }
      acc[key].total += Number(item.student_count);
      acc[key].confirmed += Number(item.confirmed_count);
      acc[key].pending += Number(item.pending_count);
      acc[key].rejected += Number(item.rejected_count);
      return acc;
    }, {} as Record<string, { total: number; confirmed: number; pending: number; rejected: number }>);

  const sortedSubjects = Object.entries(topSubjects || {})
    .sort(([, a], [, b]) => b.total - a.total)
    .slice(0, 10);

  const totalInscriptions = statisticsData?.reduce((sum, item) => sum + Number(item.student_count), 0) || 0;
  const totalConfirmed = statisticsData?.reduce((sum, item) => sum + Number(item.confirmed_count), 0) || 0;
  const totalPending = statisticsData?.reduce((sum, item) => sum + Number(item.pending_count), 0) || 0;
  const totalRejected = statisticsData?.reduce((sum, item) => sum + Number(item.rejected_count), 0) || 0;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <BarChart3 className="h-4 w-4 mr-2" />
          Estadísticas
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Estadísticas de Inscripciones a Exámenes</DialogTitle>
          <DialogDescription>
            Análisis detallado de las inscripciones por profesorado, turno, año y materia
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-sm text-muted-foreground">Cargando estadísticas...</div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Overview Cards */}
            <div className="grid grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center">
                    <Users className="h-4 w-4 mr-2" />
                    Total Inscripciones
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalInscriptions}</div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center text-green-600">
                    <Clock className="h-4 w-4 mr-2" />
                    Confirmadas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{totalConfirmed}</div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center text-yellow-600">
                    <Clock className="h-4 w-4 mr-2" />
                    Pendientes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-yellow-600">{totalPending}</div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center text-red-600">
                    <Clock className="h-4 w-4 mr-2" />
                    Rechazadas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{totalRejected}</div>
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="profesorado" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="profesorado">Por Profesorado</TabsTrigger>
                <TabsTrigger value="turno">Por Turno</TabsTrigger>
                <TabsTrigger value="year">Por Año</TabsTrigger>
                <TabsTrigger value="subjects">Por Materia</TabsTrigger>
              </TabsList>

              <TabsContent value="profesorado" className="space-y-4">
                <div className="grid gap-4">
                  {Object.entries(groupedByProfesorado || {}).map(([profesorado, stats]) => (
                    <Card key={profesorado}>
                      <CardHeader>
                        <CardTitle className="text-base">{profesorado}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-4 gap-4 text-sm">
                          <div>
                            <div className="font-medium">Total</div>
                            <div className="text-2xl font-bold">{stats.total}</div>
                          </div>
                          <div>
                            <div className="font-medium text-green-600">Confirmadas</div>
                            <div className="text-xl font-bold text-green-600">{stats.confirmed}</div>
                          </div>
                          <div>
                            <div className="font-medium text-yellow-600">Pendientes</div>
                            <div className="text-xl font-bold text-yellow-600">{stats.pending}</div>
                          </div>
                          <div>
                            <div className="font-medium text-red-600">Rechazadas</div>
                            <div className="text-xl font-bold text-red-600">{stats.rejected}</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="turno" className="space-y-4">
                <div className="grid gap-4">
                  {Object.entries(groupedByTurno || {}).map(([turno, stats]) => (
                    <Card key={turno}>
                      <CardHeader>
                        <CardTitle className="text-base capitalize">Turno {turno}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-4 gap-4 text-sm">
                          <div>
                            <div className="font-medium">Total</div>
                            <div className="text-2xl font-bold">{stats.total}</div>
                          </div>
                          <div>
                            <div className="font-medium text-green-600">Confirmadas</div>
                            <div className="text-xl font-bold text-green-600">{stats.confirmed}</div>
                          </div>
                          <div>
                            <div className="font-medium text-yellow-600">Pendientes</div>
                            <div className="text-xl font-bold text-yellow-600">{stats.pending}</div>
                          </div>
                          <div>
                            <div className="font-medium text-red-600">Rechazadas</div>
                            <div className="text-xl font-bold text-red-600">{stats.rejected}</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="year" className="space-y-4">
                <div className="grid gap-4">
                  {Object.entries(groupedByYear || {}).map(([year, stats]) => (
                    <Card key={year}>
                      <CardHeader>
                        <CardTitle className="text-base">{year} Año</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-4 gap-4 text-sm">
                          <div>
                            <div className="font-medium">Total</div>
                            <div className="text-2xl font-bold">{stats.total}</div>
                          </div>
                          <div>
                            <div className="font-medium text-green-600">Confirmadas</div>
                            <div className="text-xl font-bold text-green-600">{stats.confirmed}</div>
                          </div>
                          <div>
                            <div className="font-medium text-yellow-600">Pendientes</div>
                            <div className="text-xl font-bold text-yellow-600">{stats.pending}</div>
                          </div>
                          <div>
                            <div className="font-medium text-red-600">Rechazadas</div>
                            <div className="text-xl font-bold text-red-600">{stats.rejected}</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="subjects" className="space-y-4">
                <div className="grid gap-2">
                  <div className="text-sm text-muted-foreground mb-2">Top 10 materias con más inscripciones:</div>
                  {sortedSubjects.map(([subject, stats]) => (
                    <Card key={subject}>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-center">
                          <div className="font-medium text-sm">{subject}</div>
                          <div className="flex gap-6 text-sm">
                            <span className="font-bold">{stats.total} total</span>
                            <span className="text-green-600">{stats.confirmed} conf.</span>
                            <span className="text-yellow-600">{stats.pending} pend.</span>
                            <span className="text-red-600">{stats.rejected} rech.</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}