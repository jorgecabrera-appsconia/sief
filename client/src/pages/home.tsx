import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { UserRound } from "lucide-react";
import EnhancedForm from "@/components/enhanced-form";
import InscriptionStatusChecker from "@/components/inscription-status-checker";
import logoPath from "@assets/logoarcoyletrasblanco_1753234107653.png";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-primary text-white shadow-sm">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <img
                src={logoPath}
                alt="ISFD Logo"
                className="h-8 w-8 mr-2 object-contain"
              />
              <span className="font-semibold text-lg">
                ISFD "Dr. Pedro Ignacio de Castro Barros"
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <InscriptionStatusChecker />
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="bg-gradient-to-br from-primary to-blue-700 text-white py-16">
        <div className="container mx-auto px-4 text-center">
          <div className="w-16 h-16 flex items-center justify-center mx-auto mb-4">
            <img
              src={logoPath}
              alt="ISFD Logo"
              className="h-16 w-16 object-contain"
            />
          </div>
          <h1 className="text-4xl font-bold mb-3">
            Sistema de Inscripción a Exámenes Finales
          </h1>
          <p className="text-xl mb-4">
            Instituto Superior de Formación Docente "Dr. Pedro Ignacio de Castro
            Barros"
          </p>
          <p className="text-lg opacity-90">
            Complete el formulario para inscribirse a las mesas de examen
            disponibles
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Registration Form */}
          <Card>
            <CardHeader className="bg-primary text-white rounded-t-lg">
              <h3 className="text-xl font-semibold flex items-center">
                <UserRound className="w-5 h-5 mr-2" />
                Formulario de Inscripción
              </h3>
            </CardHeader>
            <CardContent className="p-6">
              <EnhancedForm />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-primary text-white py-8 mt-16">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h5 className="font-semibold text-lg mb-2">
                ISFD "Dr. Pedro Ignacio de Castro Barros"
              </h5>
              <p className="mb-1">Instituto Superior de Formación Docente</p>
              <p>Sistema de Inscripción a Exámenes Finales</p>
            </div>
            <div className="text-right">
              <p className="mb-1">
                <span className="mr-2">✉</span>direccion@castrobarros.edu.ar
              </p>
            </div>
          </div>
          <hr className="my-4 border-blue-400" />
          <div className="text-center">
            <small>
              &copy; Equipo de Gestión 2025/2027 - ISFD "Dr. Pedro Ignacio de
              Castro Barros". Todos los derechos reservados.
            </small>
          </div>
        </div>
      </footer>
    </div>
  );
}
