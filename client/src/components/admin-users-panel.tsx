import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

type AdminRole = "admin" | "superadmin";

interface ManagedAdminUser {
  id: number;
  username: string;
  role: AdminRole;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: string | null;
  updatedAt: string;
}

interface AuditEntry {
  id: number;
  actorUsername: string;
  targetUsername: string;
  action: string;
  changes: Record<string, unknown>;
  createdAt: string;
}

interface AdminUsersPanelProps {
  currentUser: ManagedAdminUser;
  onCurrentUserUpdated: (user: ManagedAdminUser) => void;
}

const emptyCreateForm = {
  username: "",
  password: "",
  confirmation: "",
  role: "admin" as AdminRole,
  isActive: true,
  mustChangePassword: false,
};

const actionLabels: Record<string, string> = {
  created: "Creó",
  updated: "Modificó",
  password_reset: "Restableció contraseña",
  password_changed_self: "Cambió su contraseña",
  activated: "Activó",
  deactivated: "Desactivó",
  deleted: "Eliminó",
};

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString("es-AR") : "—";
}

export default function AdminUsersPanel({
  currentUser,
  onCurrentUserUpdated,
}: AdminUsersPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [editingUser, setEditingUser] = useState<ManagedAdminUser | null>(null);
  const [editUsername, setEditUsername] = useState("");
  const [editRole, setEditRole] = useState<AdminRole>("admin");
  const [editIsActive, setEditIsActive] = useState(true);
  const [editMustChange, setEditMustChange] = useState(false);
  const [resetUser, setResetUser] = useState<ManagedAdminUser | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetConfirmation, setResetConfirmation] = useState("");
  const [resetMustChange, setResetMustChange] = useState(true);
  const [deletingUser, setDeletingUser] = useState<ManagedAdminUser | null>(null);
  const [auditPage, setAuditPage] = useState(0);
  const pageSize = 20;

  const { data: users = [], isLoading } = useQuery<ManagedAdminUser[]>({
    queryKey: ["/api/admin/users"],
  });
  const { data: auditData } = useQuery<{ entries: AuditEntry[]; total: number }>({
    queryKey: [`/api/admin/users/audit?limit=${pageSize}&offset=${auditPage * pageSize}`],
  });

  const activeSuperadmins = useMemo(
    () => users.filter((user) => user.role === "superadmin" && user.isActive).length,
    [users],
  );

  useEffect(() => {
    if (!editingUser) return;
    setEditUsername(editingUser.username);
    setEditRole(editingUser.role);
    setEditIsActive(editingUser.isActive);
    setEditMustChange(editingUser.mustChangePassword);
  }, [editingUser]);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] }),
      queryClient.invalidateQueries({ predicate: ({ queryKey }) => String(queryKey[0]).startsWith("/api/admin/users/audit") }),
    ]);
  };

  const showError = (title: string, error: any) => toast({
    title,
    description: error.message,
    variant: "destructive",
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/admin/users", {
        username: createForm.username,
        password: createForm.password,
        role: createForm.role,
        isActive: createForm.isActive,
        mustChangePassword: createForm.mustChangePassword,
      });
      return response.json();
    },
    onSuccess: async () => {
      await refresh();
      setIsCreateOpen(false);
      setCreateForm(emptyCreateForm);
      toast({ title: "Usuario creado correctamente" });
    },
    onError: (error) => showError("No se pudo crear el usuario", error),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("PATCH", `/api/admin/users/${editingUser!.id}`, {
        username: editUsername,
        role: editRole,
        isActive: editIsActive,
        mustChangePassword: editMustChange,
      });
      return response.json();
    },
    onSuccess: async (updated: ManagedAdminUser) => {
      await refresh();
      if (updated.id === currentUser.id) onCurrentUserUpdated(updated);
      setEditingUser(null);
      toast({ title: "Usuario actualizado correctamente" });
    },
    onError: (error) => showError("No se pudo actualizar el usuario", error),
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("PUT", `/api/admin/users/${resetUser!.id}/password`, {
        newPassword: resetPassword,
        mustChangePassword: resetMustChange,
      });
      return response.json();
    },
    onSuccess: async () => {
      await refresh();
      setResetUser(null);
      setResetPassword("");
      setResetConfirmation("");
      toast({ title: "Contraseña restablecida correctamente" });
    },
    onError: (error) => showError("No se pudo restablecer la contraseña", error),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => apiRequest("DELETE", `/api/admin/users/${deletingUser!.id}`),
    onSuccess: async () => {
      await refresh();
      setDeletingUser(null);
      toast({ title: "Usuario eliminado correctamente" });
    },
    onError: (error) => showError("No se pudo eliminar el usuario", error),
  });

  const validatePassword = (password: string, confirmation: string) => {
    if (password.length < 8 || password.length > 128) {
      toast({ title: "La contraseña debe tener entre 8 y 128 caracteres", variant: "destructive" });
      return false;
    }
    if (password !== confirmation) {
      toast({ title: "Las contraseñas no coinciden", variant: "destructive" });
      return false;
    }
    return true;
  };

  const isProtectedSuperadmin = (user: ManagedAdminUser) =>
    user.role === "superadmin" && user.isActive && activeSuperadmins <= 1;

  return (
    <div className="space-y-6" data-testid="admin-users-panel">
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center justify-between gap-3">
            <span>Administración de usuarios</span>
            <Button size="sm" onClick={() => setIsCreateOpen(true)} data-testid="button-add-admin-user">
              <Plus className="h-4 w-4 mr-2" />
              Agregar usuario
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando usuarios...</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Cambio pendiente</TableHead>
                    <TableHead>Creado</TableHead>
                    <TableHead>Actualizado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => {
                    const isSelf = user.id === currentUser.id;
                    const protectedSuperadmin = isProtectedSuperadmin(user);
                    return (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          {user.username}{isSelf ? " (usted)" : ""}
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.role === "superadmin" ? "default" : "secondary"}>
                            {user.role === "superadmin" ? "Superadministrador" : "Administrador"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.isActive ? "outline" : "destructive"}>
                            {user.isActive ? "Activo" : "Inactivo"}
                          </Badge>
                        </TableCell>
                        <TableCell>{user.mustChangePassword ? "Sí" : "No"}</TableCell>
                        <TableCell>{formatDate(user.createdAt)}</TableCell>
                        <TableCell>{formatDate(user.updatedAt)}</TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" aria-label={`Editar ${user.username}`} onClick={() => setEditingUser(user)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label={`Restablecer contraseña de ${user.username}`}
                              disabled={isSelf}
                              onClick={() => {
                                setResetUser(user);
                                setResetMustChange(true);
                              }}
                            >
                              <KeyRound className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="text-red-600"
                              aria-label={`Eliminar ${user.username}`}
                              disabled={isSelf || protectedSuperadmin}
                              onClick={() => setDeletingUser(user)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historial de administración</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!auditData?.entries.length ? (
            <p className="text-sm text-muted-foreground">Todavía no hay acciones registradas.</p>
          ) : (
            <div className="space-y-3">
              {auditData.entries.map((entry) => (
                <div key={entry.id} className="rounded-md border p-3 text-sm">
                  <div className="flex flex-wrap justify-between gap-2">
                    <span>
                      <strong>{entry.actorUsername}</strong> {actionLabels[entry.action] ?? entry.action.toLowerCase()} a <strong>{entry.targetUsername}</strong>
                    </span>
                    <span className="text-muted-foreground">{formatDate(entry.createdAt)}</span>
                  </div>
                  {Object.keys(entry.changes ?? {}).length > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Campos: {Object.keys(entry.changes).join(", ")}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" disabled={auditPage === 0} onClick={() => setAuditPage((page) => page - 1)}>
              Anterior
            </Button>
            <span className="text-xs text-muted-foreground">
              Página {auditPage + 1} · {auditData?.total ?? 0} acciones
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={!auditData || (auditPage + 1) * pageSize >= auditData.total}
              onClick={() => setAuditPage((page) => page + 1)}
            >
              Siguiente
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Agregar usuario</DialogTitle>
            <DialogDescription>Defina sus credenciales, rol y estado inicial.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={(event) => {
            event.preventDefault();
            if (validatePassword(createForm.password, createForm.confirmation)) createMutation.mutate();
          }}>
            <div className="space-y-2">
              <Label htmlFor="create-admin-username">Usuario</Label>
              <Input id="create-admin-username" value={createForm.username} onChange={(event) => setCreateForm({ ...createForm, username: event.target.value })} required minLength={3} maxLength={50} />
            </div>
            <div className="space-y-2">
              <Label>Rol</Label>
              <Select value={createForm.role} onValueChange={(role: AdminRole) => setCreateForm({ ...createForm, role })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="superadmin">Superadministrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <PasswordFields password={createForm.password} confirmation={createForm.confirmation} onPassword={(password) => setCreateForm({ ...createForm, password })} onConfirmation={(confirmation) => setCreateForm({ ...createForm, confirmation })} prefix="create" />
            <BooleanField label="Usuario activo" checked={createForm.isActive} onChange={(isActive) => setCreateForm({ ...createForm, isActive })} />
            <BooleanField label="Exigir cambio de contraseña al ingresar" checked={createForm.mustChangePassword} onChange={(mustChangePassword) => setCreateForm({ ...createForm, mustChangePassword })} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={createMutation.isPending}>{createMutation.isPending ? "Guardando..." : "Crear usuario"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={editingUser !== null} onOpenChange={(open) => { if (!open) setEditingUser(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar usuario</DialogTitle>
            <DialogDescription>Los cambios de acceso cerrarán las demás sesiones del usuario.</DialogDescription>
          </DialogHeader>
          {editingUser && <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); updateMutation.mutate(); }}>
            <div className="space-y-2">
              <Label htmlFor="edit-admin-username">Usuario</Label>
              <Input id="edit-admin-username" value={editUsername} onChange={(event) => setEditUsername(event.target.value)} required minLength={3} maxLength={50} />
            </div>
            <div className="space-y-2">
              <Label>Rol</Label>
              <Select value={editRole} disabled={editingUser.id === currentUser.id || isProtectedSuperadmin(editingUser)} onValueChange={(role: AdminRole) => setEditRole(role)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="superadmin">Superadministrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <BooleanField label="Usuario activo" checked={editIsActive} disabled={editingUser.id === currentUser.id || isProtectedSuperadmin(editingUser)} onChange={setEditIsActive} />
            <BooleanField label="Exigir cambio de contraseña al ingresar" checked={editMustChange} onChange={setEditMustChange} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditingUser(null)}>Cancelar</Button>
              <Button type="submit" disabled={updateMutation.isPending}>{updateMutation.isPending ? "Guardando..." : "Guardar cambios"}</Button>
            </div>
          </form>}
        </DialogContent>
      </Dialog>

      <Dialog open={resetUser !== null} onOpenChange={(open) => { if (!open) setResetUser(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Restablecer contraseña</DialogTitle>
            <DialogDescription>Se cerrarán todas las sesiones abiertas de {resetUser?.username}.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={(event) => {
            event.preventDefault();
            if (validatePassword(resetPassword, resetConfirmation)) resetMutation.mutate();
          }}>
            <PasswordFields password={resetPassword} confirmation={resetConfirmation} onPassword={setResetPassword} onConfirmation={setResetConfirmation} prefix="reset" />
            <BooleanField label="Exigir cambio de contraseña al ingresar" checked={resetMustChange} onChange={setResetMustChange} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setResetUser(null)}>Cancelar</Button>
              <Button type="submit" disabled={resetMutation.isPending}>{resetMutation.isPending ? "Guardando..." : "Restablecer"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deletingUser !== null} onOpenChange={(open) => { if (!open) setDeletingUser(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar usuario</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará a {deletingUser?.username} y se cerrarán sus sesiones. El historial de administración se conservará.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function BooleanField({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border p-3">
      <Label>{label}</Label>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </div>
  );
}

function PasswordFields({ password, confirmation, onPassword, onConfirmation, prefix }: { password: string; confirmation: string; onPassword: (value: string) => void; onConfirmation: (value: string) => void; prefix: string }) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={`${prefix}-password`}>Nueva contraseña</Label>
        <Input id={`${prefix}-password`} type="password" autoComplete="new-password" value={password} onChange={(event) => onPassword(event.target.value)} required minLength={8} maxLength={128} />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${prefix}-confirmation`}>Confirmar contraseña</Label>
        <Input id={`${prefix}-confirmation`} type="password" autoComplete="new-password" value={confirmation} onChange={(event) => onConfirmation(event.target.value)} required />
      </div>
    </>
  );
}
