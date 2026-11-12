import { lazy, Suspense, useState, useEffect } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "@/pages/home";
import NotFound from "@/pages/not-found";
import MaintenancePage from "@/pages/maintenance";
import LoginForm from "@/components/login-form";
import { apiRequest } from "@/lib/queryClient";

const Admin = lazy(() => import("@/pages/admin"));
const Teachers = lazy(() => import("@/pages/teachers"));
const ArchivedExamsPage = lazy(() => import("@/pages/archived-exams-page"));

function AuthChecker({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [isChecking, setIsChecking] = useState(true);

  // Check maintenance mode
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
    retry: false,
  });

  const { data: authData } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      try {
        const response = await apiRequest("GET", "/api/auth/me");
        return response.json();
      } catch {
        return null;
      }
    },
    retry: false,
  });

  useEffect(() => {
    if (authData?.user) {
      setUser(authData.user);
    }
    setIsChecking(false);
  }, [authData]);

  const handleLoginSuccess = (userData: any) => {
    setUser(userData);
    queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
  };

  const handleLogout = async () => {
    try {
      await apiRequest("POST", "/api/auth/logout");
      setUser(null);
      queryClient.clear();
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  // Show maintenance page for public pages only (not admin panel or docentes)
  const isAdminRoute = window.location.pathname.startsWith('/admin');
  const isDocentesRoute = window.location.pathname.startsWith('/docentes');
  if (maintenanceData?.maintenanceMode && !isAdminRoute && !isDocentesRoute) {
    return <MaintenancePage />;
  }

  if (isChecking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Verificando autenticación...</p>
        </div>
      </div>
    );
  }

  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/admin">
        {user ? (
          <Admin user={user} onLogout={handleLogout} />
        ) : (
          <LoginForm onLoginSuccess={handleLoginSuccess} />
        )}
      </Route>
      <Route path="/docentes" component={Teachers} />
      <Route path="/mesas-julio-2025" component={ArchivedExamsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Suspense
          fallback={
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
              <p className="text-gray-600">Cargando…</p>
            </div>
          }
        >
          <AuthChecker>
            <div />
          </AuthChecker>
        </Suspense>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
