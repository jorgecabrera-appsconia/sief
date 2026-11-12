import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import ArchivedExams from "@/components/archived-exams";
import logoPath from "@assets/logoarcoyletrasblanco_1753234107653.png";

export default function ArchivedExamsPage() {
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
            <Link href="/">
              <Button variant="ghost" className="text-white hover:bg-blue-700" data-testid="button-back-home">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Volver al inicio
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="bg-gradient-to-br from-amber-600 to-amber-700 text-white py-12">
        <div className="container mx-auto px-4 text-center">
          <div className="w-16 h-16 flex items-center justify-center mx-auto mb-4">
            <img
              src={logoPath}
              alt="ISFD Logo"
              className="h-16 w-16 object-contain"
            />
          </div>
          <h1 className="text-4xl font-bold mb-3">
            Mesas de Exámenes - Julio 2025
          </h1>
          <p className="text-xl mb-2">
            Instituto Superior de Formación Docente "Dr. Pedro Ignacio de Castro
            Barros"
          </p>
          <p className="text-lg opacity-90">
            Registro histórico - Inscripciones cerradas
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <ArchivedExams />
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
