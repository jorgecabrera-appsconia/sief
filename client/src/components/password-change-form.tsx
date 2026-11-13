import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface PasswordChangeFormProps {
  onSuccess: (user: any) => void;
  onCancel?: () => void;
  submitLabel?: string;
}

export default function PasswordChangeForm({
  onSuccess,
  onCancel,
  submitLabel = "Cambiar contraseña",
}: PasswordChangeFormProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/auth/change-password", {
        currentPassword,
        newPassword,
      });
      return response.json();
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmation("");
      toast({ title: "Contraseña actualizada correctamente" });
      onSuccess(data.user);
    },
    onError: (error: any) => {
      toast({
        title: "No se pudo cambiar la contraseña",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (newPassword.length < 8 || newPassword.length > 128) {
      toast({
        title: "La nueva contraseña debe tener entre 8 y 128 caracteres",
        variant: "destructive",
      });
      return;
    }
    if (newPassword !== confirmation) {
      toast({ title: "Las contraseñas nuevas no coinciden", variant: "destructive" });
      return;
    }
    mutation.mutate();
  };

  return (
    <form onSubmit={submit} className="space-y-4" data-testid="form-change-password">
      <div className="space-y-2">
        <Label htmlFor="current-password">Contraseña actual</Label>
        <Input
          id="current-password"
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="new-password">Nueva contraseña</Label>
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          required
          minLength={8}
          maxLength={128}
        />
        <p className="text-xs text-muted-foreground">Debe tener entre 8 y 128 caracteres.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm-new-password">Confirmar nueva contraseña</Label>
        <Input
          id="confirm-new-password"
          type="password"
          autoComplete="new-password"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          required
        />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Guardando..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
