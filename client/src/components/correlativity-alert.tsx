import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Subject } from "@shared/schema";

interface CorrelativityAlertProps {
  subject: string;
  prerequisites: Subject[];
  onCancel: () => void;
  onApprove: () => void;
}

export default function CorrelativityAlert({
  subject,
  prerequisites,
  onCancel,
  onApprove,
}: CorrelativityAlertProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg flex items-center text-orange-600">
            <AlertTriangle className="w-5 h-5 mr-2" />
            Atención - Correlatividades
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="h-6 w-6 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-orange-50 border border-orange-200 p-3 rounded">
            <p className="text-sm text-orange-800 mb-2">
              <strong>
                Para rendir "{subject}" usted debe tener aprobadas las siguientes unidades curriculares:
              </strong>
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm text-orange-700">
              {prerequisites.map((prereq, index) => (
                <li key={index}>{prereq.name}</li>
              ))}
            </ul>
          </div>

          <p className="text-sm text-gray-600">¿La/s tiene aprobada/s?</p>

          <div className="flex gap-3">
            <Button variant="outline" onClick={onCancel} className="flex-1">
              Cancelar
            </Button>
            <Button
              onClick={onApprove}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              Las aprobé
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
