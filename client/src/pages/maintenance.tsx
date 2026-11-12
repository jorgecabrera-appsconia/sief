import logoPath from "@assets/logoarcoyletrasblanco_1753234107653.png";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function MaintenancePage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto mb-4 bg-primary rounded-xl p-4 inline-block">
            <img
              src={logoPath}
              alt="ISFD Logo"
              className="h-16 w-16 object-contain"
            />
          </div>
          <CardTitle className="text-2xl text-gray-800">
            La inscripción a mesas de exámenes no está habilitada.
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-gray-600">
            El sistema de inscripción a exámenes se encuentra cerrado.
          </p>
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-700">
              Si necesita asistencia urgente, contacte a la administración del instituto.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
