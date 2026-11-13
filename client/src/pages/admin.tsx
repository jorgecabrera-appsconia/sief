import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import AdminLogin from "@/components/admin-login";
import AdminDashboard from "@/components/admin-dashboard";
import PasswordChangeForm from "@/components/password-change-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getQueryFn } from "@/lib/queryClient";

interface AdminProps {
  user?: any;
  onLogout?: () => void;
}

export default function Admin({ user: propUser, onLogout }: AdminProps) {
  const [user, setUser] = useState(propUser);

  // Check authentication status
  const { data: authUser, isLoading } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const handleLoginSuccess = (userData: any) => {
    setUser(userData);
  };

  const handleLogout = () => {
    setUser(null);
    if (onLogout) onLogout();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Verificando autenticación...</p>
        </div>
      </div>
    );
  }

  const currentUser = user || (authUser as any)?.user || authUser;

  if (!currentUser) {
    return <AdminLogin onLoginSuccess={handleLoginSuccess} />;
  }

  if (currentUser.mustChangePassword) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Cambio de contraseña obligatorio</CardTitle>
            <CardDescription>
              Debe definir una nueva contraseña antes de continuar al panel de administración.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <PasswordChangeForm
              onSuccess={(updatedUser) => setUser(updatedUser)}
              submitLabel="Guardar y continuar"
            />
            <Button type="button" variant="ghost" className="w-full" onClick={handleLogout}>
              Cerrar sesión
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <AdminDashboard
      user={currentUser}
      onLogout={handleLogout}
      onUserUpdated={(updatedUser) => setUser(updatedUser)}
    />
  );
}
