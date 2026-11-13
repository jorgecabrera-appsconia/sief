import type { Express, Request, Response, NextFunction } from "express";
import {
  AdminUserManagementError,
  RegistrationError,
  storage as defaultStorage,
  type IStorage,
} from "./storage.js";
import { insertStudentSchema, insertExamScheduleSchema, insertInscriptionSchema, insertExamCallSchema, insertSubjectSchema, type AdminUser, type ExamSchedule, type Inscription } from "../shared/schema.js";
import { z } from "zod";
import { toPublicTeacherStudent } from "./security.js";

declare module 'express-session' {
  interface SessionData {
    user?: {
      id: number;
      username: string;
      role: string;
      isActive: boolean;
      mustChangePassword: boolean;
      sessionVersion: number;
    };
  }
}

interface AuthenticatedRequest extends Request {
  user?: AdminUser;
}

function toPublicAdminUser(user: AdminUser) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function toSessionAdminUser(user: AdminUser) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
    sessionVersion: user.sessionVersion,
  };
}

function adminErrorStatus(error: AdminUserManagementError) {
  if (error.code === "USER_NOT_FOUND") return 404;
  if (error.code === "INVALID_CURRENT_PASSWORD") return 400;
  return 409;
}

async function findExamCallForDate(storage: IStorage, date: string) {
  const examCalls = await storage.getAllExamCalls();
  const matching = examCalls.filter(call => {
    if (!call.startDate || !call.endDate) return false;
    return date >= call.startDate && date <= call.endDate;
  });
  if (matching.length === 0) return null;
  const active = matching.find(c => c.isActive);
  if (active) return active;
  matching.sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''));
  return matching[0];
}

export function registerRoutes(
  app: Express,
  storage: IStorage = defaultStorage,
): void {
  const requireSession = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    const sessionUser = req.session?.user;
    if (!sessionUser) {
      return res.status(401).json({ error: "Authentication required" });
    }
    try {
      const currentUser = await storage.getAdminUserById(sessionUser.id);
      const expectedVersion = sessionUser.sessionVersion ?? 1;
      if (
        !currentUser ||
        !currentUser.isActive ||
        currentUser.sessionVersion !== expectedVersion
      ) {
        req.session.destroy(() => undefined);
        return res.status(401).json({ error: "Session invalidated", code: "SESSION_INVALID" });
      }
      req.user = currentUser;
      req.session.user = toSessionAdminUser(currentUser);
      next();
    } catch (error) {
      next(error);
    }
  };

  const requireAuth = (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => requireSession(req, res, () => {
    if (req.user?.mustChangePassword) {
      return res.status(403).json({
        error: "Debe cambiar su contraseña antes de continuar",
        code: "PASSWORD_CHANGE_REQUIRED",
      });
    }
    next();
  });

  const requireSuperadmin = (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => requireAuth(req, res, () => {
    if (req.user?.role !== "superadmin") {
      return res.status(403).json({
        error: "Se requiere rol de superadministrador",
        code: "SUPERADMIN_REQUIRED",
      });
    }
    next();
  });

  const publicRegistrationSchema = z
    .object({
      student: insertStudentSchema.extend({
        firstName: z.string().trim().min(1).max(100),
        lastName: z.string().trim().min(1).max(100),
        dni: z.string().regex(/^\d{7,9}$/),
        phone: z.string().trim().min(6).max(30),
        email: z.string().trim().email().max(254),
        profesorado: z.enum([
          "Educación Inicial",
          "Educación Primaria",
          "Biología",
        ]),
        turno: z.enum(["mañana", "siesta", "tarde"]),
        year: z.number().int().min(1).max(4),
        division: z.string().trim().min(1).max(3),
        yearEntered: z.number().int().min(1900).max(2100).nullable().optional(),
      }),
      examScheduleIds: z.array(z.string().regex(/^\d+$/)).min(1).max(10),
      examConditions: z.array(z.enum(["regular", "libre"])).min(1).max(10),
    })
    .refine(
      (data) => data.examScheduleIds.length === data.examConditions.length,
      { message: "Debe indicar una condición por cada mesa" },
    );

  // Authentication routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = z.object({
        username: z.string().trim().min(1).max(50),
        password: z.string().min(1).max(128),
      }).strict().parse(req.body);
      const user = await storage.validateAdminCredentials(username, password);
      if (!user) {
        return res.status(401).json({ error: "Credenciales inválidas" });
      }
      req.session.user = toSessionAdminUser(user);
      res.json({ user: toPublicAdminUser(user) });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(401).json({ error: "Credenciales inválidas" });
      }
      res.status(500).json({ error: "Error al iniciar sesión" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Error al cerrar sesión" });
      }
      res.json({ message: "Sesión cerrada exitosamente" });
    });
  });

  app.get("/api/auth/me", requireSession, (req: AuthenticatedRequest, res) => {
    res.json({ user: toPublicAdminUser(req.user!) });
  });

  app.post("/api/auth/change-password", requireSession, async (req: AuthenticatedRequest, res) => {
    try {
      const input = z.object({
        currentPassword: z.string().min(1).max(128),
        newPassword: z.string().min(8).max(128),
      }).strict().parse(req.body);
      const updated = await storage.changeAdminPassword(
        req.user!.id,
        input.currentPassword,
        input.newPassword,
      );
      req.session.user = toSessionAdminUser(updated);
      res.json({ user: toPublicAdminUser(updated) });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Datos de contraseña inválidos", code: "VALIDATION_ERROR" });
      }
      if (error instanceof AdminUserManagementError) {
        return res.status(adminErrorStatus(error)).json({ error: error.message, code: error.code });
      }
      res.status(500).json({ error: "Error al cambiar la contraseña" });
    }
  });

  app.get("/api/admin/users", requireSuperadmin, async (_req, res) => {
    try {
      const users = await storage.listAdminUsers();
      res.json(users.map(toPublicAdminUser));
    } catch {
      res.status(500).json({ error: "Error al obtener usuarios" });
    }
  });

  const usernameSchema = z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(50)
    .regex(/^[a-z0-9._-]+$/, "El usuario contiene caracteres no permitidos");
  const passwordSchema = z.string().min(8).max(128);
  const roleSchema = z.enum(["admin", "superadmin"]);
  const createAdminUserSchema = z.object({
    username: usernameSchema,
    password: passwordSchema,
    role: roleSchema,
    isActive: z.boolean().default(true),
    mustChangePassword: z.boolean().default(false),
  }).strict();
  const updateAdminUserSchema = z.object({
    username: usernameSchema.optional(),
    role: roleSchema.optional(),
    isActive: z.boolean().optional(),
    mustChangePassword: z.boolean().optional(),
  }).strict().refine((input) => Object.keys(input).length > 0, "Debe indicar al menos un cambio");
  const resetPasswordSchema = z.object({
    newPassword: passwordSchema,
    mustChangePassword: z.boolean(),
  }).strict();
  const adminUserIdSchema = z.coerce.number().int().positive();

  const sendAdminUserError = (error: unknown, res: Response, fallback: string) => {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Datos inválidos", code: "VALIDATION_ERROR" });
    }
    if (error instanceof AdminUserManagementError) {
      return res.status(adminErrorStatus(error)).json({ error: error.message, code: error.code });
    }
    console.error(fallback, error instanceof Error ? error.name : "UnknownError");
    return res.status(500).json({ error: fallback });
  };

  app.post("/api/admin/users", requireSuperadmin, async (req: AuthenticatedRequest, res) => {
    try {
      const input = createAdminUserSchema.parse(req.body);
      const created = await storage.createManagedAdminUser(input, {
        id: req.user!.id,
        username: req.user!.username,
      });
      res.status(201).json(toPublicAdminUser(created));
    } catch (error) {
      sendAdminUserError(error, res, "Error al crear usuario");
    }
  });

  app.patch("/api/admin/users/:id", requireSuperadmin, async (req: AuthenticatedRequest, res) => {
    try {
      const id = adminUserIdSchema.parse(req.params.id);
      const input = updateAdminUserSchema.parse(req.body);
      const updated = await storage.updateManagedAdminUser(id, input, {
        id: req.user!.id,
        username: req.user!.username,
      });
      if (updated.id === req.user!.id) {
        req.session.user = toSessionAdminUser(updated);
      }
      res.json(toPublicAdminUser(updated));
    } catch (error) {
      sendAdminUserError(error, res, "Error al actualizar usuario");
    }
  });

  app.put("/api/admin/users/:id/password", requireSuperadmin, async (req: AuthenticatedRequest, res) => {
    try {
      const id = adminUserIdSchema.parse(req.params.id);
      const input = resetPasswordSchema.parse(req.body);
      const updated = await storage.resetManagedAdminPassword(id, input, {
        id: req.user!.id,
        username: req.user!.username,
      });
      res.json(toPublicAdminUser(updated));
    } catch (error) {
      sendAdminUserError(error, res, "Error al restablecer contraseña");
    }
  });

  app.delete("/api/admin/users/:id", requireSuperadmin, async (req: AuthenticatedRequest, res) => {
    try {
      const id = adminUserIdSchema.parse(req.params.id);
      await storage.deleteManagedAdminUser(id, {
        id: req.user!.id,
        username: req.user!.username,
      });
      res.status(204).send();
    } catch (error) {
      sendAdminUserError(error, res, "Error al eliminar usuario");
    }
  });

  app.get("/api/admin/users/audit", requireSuperadmin, async (req, res) => {
    try {
      const query = z.object({
        limit: z.coerce.number().int().min(1).max(100).default(50),
        offset: z.coerce.number().int().min(0).default(0),
      }).parse(req.query);
      const result = await storage.listAdminUserAudit(query.limit, query.offset);
      res.json(result);
    } catch (error) {
      sendAdminUserError(error, res, "Error al obtener historial de usuarios");
    }
  });

  app.get("/api/public/students/dni/:dni", async (req, res) => {
    if (!/^\d{7,9}$/.test(req.params.dni)) {
      return res.status(400).json({ message: "DNI inválido" });
    }
    const student = await storage.getStudentByDni(req.params.dni);
    res.json({ exists: Boolean(student) });
  });

  app.post("/api/public/registrations", async (req, res) => {
    try {
      const input = publicRegistrationSchema.parse(req.body);
      const result = await storage.createPublicRegistration(input);
      res.status(201).json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(422).json({ message: "Datos inválidos" });
      }
      if (error instanceof RegistrationError) {
        const status =
          error.code === "CONTACT_MISMATCH" ||
          error.code === "DUPLICATE_REGISTRATION"
            ? 409
            : 400;
        return res.status(status).json({ message: error.message });
      }
      console.error("Public registration failed", error);
      res.status(500).json({ message: "Error al crear inscripción" });
    }
  });

  app.get("/api/public/teacher-portal", async (req, res) => {
    const parsedId = z.coerce.number().int().positive().safeParse(
      req.query.examScheduleId,
    );
    if (!parsedId.success) {
      return res.status(400).json({ message: "Mesa inválida" });
    }

    const [examSchedule, activeCall] = await Promise.all([
      storage.getExamSchedule(parsedId.data),
      storage.getActiveExamCall(),
    ]);
    if (
      !examSchedule ||
      !activeCall ||
      examSchedule.examCallId !== activeCall.id
    ) {
      return res.status(404).json({ message: "Mesa no encontrada" });
    }

    const inscriptions = await storage.getInscriptionsByExamCallId(activeCall.id);
    const students = (
      await Promise.all(
        inscriptions.map(async (inscription) => {
          const examIndex = inscription.examScheduleIds.indexOf(
            String(examSchedule.id),
          );
          if (examIndex < 0) return null;
          const student = await storage.getStudent(inscription.studentId);
          if (!student) return null;
          return toPublicTeacherStudent({
            ...student,
            condition: inscription.examConditions?.[examIndex] ?? "regular",
          });
        }),
      )
    ).filter((student): student is NonNullable<typeof student> => Boolean(student));

    students.sort((a, b) => a.lastName.localeCompare(b.lastName, "es"));
    res.json({ examSchedule, students });
  });

  // Student routes
  app.get("/api/students", requireAuth, async (req, res) => {
    try {
      const students = await storage.getAllStudents();
      res.json(students);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch students" });
    }
  });

  app.get("/api/students/dni/:dni", requireAuth, async (req, res) => {
    try {
      const dni = req.params.dni;
      const student = await storage.getStudentByDni(dni);
      
      if (!student) {
        return res.status(404).json({ message: "Estudiante no encontrado" });
      }
      
      res.json(student);
    } catch (error) {
      res.status(500).json({ message: "Error al buscar estudiante" });
    }
  });

  app.patch("/api/students/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updateData = insertStudentSchema.partial().parse(req.body);
      const updated = await storage.updateStudent(id, updateData);
      
      if (!updated) {
        return res.status(404).json({ message: "Estudiante no encontrado" });
      }
      
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Datos inválidos", errors: error.issues });
      } else {
        res.status(500).json({ message: "Error al actualizar estudiante" });
      }
    }
  });

  app.post("/api/students", requireAuth, async (req, res) => {
    try {
      const studentData = insertStudentSchema.parse(req.body);
      
      // Check if student with this DNI already exists
      const existingStudent = await storage.getStudentByDni(studentData.dni);
      if (existingStudent) {
        return res.status(400).json({ message: "Ya existe un estudiante con este DNI" });
      }

      const student = await storage.createStudent(studentData);
      res.status(201).json(student);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Datos inválidos", errors: error.issues });
      } else {
        res.status(500).json({ message: "Error al crear estudiante" });
      }
    }
  });

  // Exam schedule routes
  app.get("/api/exam-schedules", async (req, res) => {
    try {
      const { profesorado, turno, registrationOpen, period } = req.query;
      let examSchedules;
      
      if (profesorado || turno || registrationOpen !== undefined || period) {
        examSchedules = await storage.getExamSchedulesByFilters(
          profesorado as string, 
          turno as string,
          registrationOpen === 'true' ? true : registrationOpen === 'false' ? false : undefined,
          period as string
        );
      } else {
        examSchedules = await storage.getAllExamSchedules();
      }
      
      res.json(examSchedules);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch exam schedules" });
    }
  });

  app.get("/api/exam-schedules/open", async (req, res) => {
    try {
      const examSchedules = await storage.getOpenExamSchedules();
      res.json(examSchedules);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch open exam schedules" });
    }
  });

  app.get("/api/exam-schedules/archived/:period", async (req, res) => {
    try {
      const period = req.params.period;
      const examSchedules = await storage.getArchivedExamSchedules(period);
      res.json(examSchedules);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch archived exam schedules" });
    }
  });

  app.post("/api/exam-schedules", requireAuth, async (req, res) => {
    try {
      const examScheduleData = insertExamScheduleSchema.parse(req.body);

      // Associate the new mesa with the exam call that matches its date (falling back
      // to the active call), so it never keeps the legacy default period ("Julio 2025").
      if (examScheduleData.date) {
        const matchingCall = await findExamCallForDate(storage, examScheduleData.date);
        if (matchingCall) {
          examScheduleData.examCallId = matchingCall.id;
        } else {
          const activeCall = await storage.getActiveExamCall();
          if (activeCall) {
            examScheduleData.examCallId = activeCall.id;
          }
        }
      }

      const examSchedule = await storage.createExamSchedule(examScheduleData);
      res.status(201).json(examSchedule);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Datos inválidos", errors: error.issues });
      } else {
        res.status(500).json({ message: "Error al crear mesa de examen" });
      }
    }
  });

  app.put("/api/exam-schedules/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updateData = insertExamScheduleSchema.partial().parse(req.body);
      
      if (updateData.date) {
        const matchingCall = await findExamCallForDate(storage, updateData.date);
        if (matchingCall) {
          updateData.examCallId = matchingCall.id;
        }
      }
      
      const updated = await storage.updateExamSchedule(id, updateData);
      
      if (!updated) {
        return res.status(404).json({ message: "Mesa de examen no encontrada" });
      }
      
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Datos inválidos", errors: error.issues });
      } else {
        res.status(500).json({ message: "Error al actualizar mesa de examen" });
      }
    }
  });

  app.patch("/api/exam-schedules/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updateData = insertExamScheduleSchema.partial().parse(req.body);
      
      if (updateData.date) {
        const matchingCall = await findExamCallForDate(storage, updateData.date);
        if (matchingCall) {
          updateData.examCallId = matchingCall.id;
        }
      }
      
      const updated = await storage.updateExamSchedule(id, updateData);
      
      if (!updated) {
        return res.status(404).json({ message: "Mesa de examen no encontrada" });
      }
      
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Datos inválidos", errors: error.issues });
      } else {
        res.status(500).json({ message: "Error al actualizar mesa de examen" });
      }
    }
  });

  app.delete("/api/exam-schedules/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteExamSchedule(id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Mesa de examen no encontrada" });
      }
      
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Error al eliminar mesa de examen" });
    }
  });

  // Inscription routes
  app.get("/api/inscriptions", requireAuth, async (req, res) => {
    try {
      let inscriptions: Inscription[];
      if (req.query.activeOnly === "true") {
        const activeCall = await storage.getActiveExamCall();
        if (activeCall) {
          inscriptions = await storage.getInscriptionsByExamCallId(activeCall.id);
        } else {
          inscriptions = [];
        }
      } else {
        inscriptions = await storage.getAllInscriptions();
      }
      
      // Get full inscription data with student and exam schedule details
      const fullInscriptions = await Promise.all(
        inscriptions.map(async (inscription) => {
          const student = await storage.getStudent(inscription.studentId);
          
          // Fetch exam schedules with conditions, keeping track of valid ones only
          const examSchedulesWithConditions: any[] = [];
          for (let index = 0; index < inscription.examScheduleIds.length; index++) {
            const id = inscription.examScheduleIds[index];
            const exam = await storage.getExamSchedule(parseInt(id));
            if (exam) {
              // Add condition from examConditions array (defaults to "regular" if not present)
              const condition = inscription.examConditions?.[index] || "regular";
              examSchedulesWithConditions.push({ ...exam, condition });
            }
          }
          
          return {
            ...inscription,
            student,
            examSchedules: examSchedulesWithConditions
          };
        })
      );
      
      res.json(fullInscriptions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch inscriptions" });
    }
  });

  app.post("/api/inscriptions", requireAuth, async (req, res) => {
    try {
      const inscriptionData = insertInscriptionSchema.parse(req.body);

      const targetCallIds = new Set<number>();
      for (const idStr of inscriptionData.examScheduleIds) {
        const exam = await storage.getExamSchedule(parseInt(idStr));
        if (!exam || !exam.examCallId) {
          return res.status(400).json({ message: "Mesa de examen no válida" });
        }
        targetCallIds.add(exam.examCallId);
      }
      if (targetCallIds.size !== 1) {
        return res.status(400).json({ message: "Todas las materias seleccionadas deben pertenecer al mismo llamado" });
      }
      const targetCallId = Array.from(targetCallIds)[0];

      const existingInscriptions = await storage.getInscriptionsByStudent(inscriptionData.studentId);
      for (const existing of existingInscriptions) {
        for (const idStr of existing.examScheduleIds) {
          const existingExam = await storage.getExamSchedule(parseInt(idStr));
          if (existingExam && existingExam.examCallId === targetCallId) {
            return res.status(409).json({ 
              message: "Ya tenés una inscripción registrada para este llamado. Solo se permite una inscripción por llamado." 
            });
          }
        }
      }
      
      const inscription = await storage.createInscription(inscriptionData);
      res.status(201).json(inscription);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Datos inválidos", errors: error.issues });
      } else {
        res.status(500).json({ message: "Error al crear inscripción" });
      }
    }
  });

  // Update inscription status
  app.patch("/api/inscriptions/:id/status", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { status, confirmedBy } = req.body;
      
      if (!status || !["pending", "confirmed", "rejected"].includes(status)) {
        return res.status(400).json({ message: "Estado inválido" });
      }

      const updated = await storage.updateInscriptionStatus(id, status, confirmedBy);
      
      if (!updated) {
        return res.status(404).json({ message: "Inscripción no encontrada" });
      }
      
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Error al actualizar estado de inscripción" });
    }
  });

  // Get inscription status by DNI
  app.get("/api/inscriptions/status/:dni", async (req, res) => {
    try {
      const dni = req.params.dni;
      
      const student = await storage.getStudentByDni(dni);
      if (!student) {
        return res.status(404).json({ message: "No hay inscripción registrada con ese DNI" });
      }
      
      const studentInscriptions = await storage.getInscriptionsByStudent(student.id);
      
      if (!studentInscriptions || studentInscriptions.length === 0) {
        return res.status(404).json({ message: "No hay inscripción registrada con ese DNI" });
      }
      
      const allExamCalls = await storage.getAllExamCalls();
      
      const groupedByCall: Record<string, { inscriptions: any[], examSchedules: ExamSchedule[], examCall: any }> = {};
      
      for (const inscription of studentInscriptions) {
        const examSchedules = (await Promise.all(
          inscription.examScheduleIds.map(id => storage.getExamSchedule(parseInt(id)))
        )).filter(Boolean) as ExamSchedule[];
        
        let examCall = null;
        let groupKey = "sin-llamado";
        const examCallIds = Array.from(new Set(examSchedules.map(es => es.examCallId).filter(Boolean)));
        if (examCallIds.length > 0) {
          examCall = allExamCalls.find(ec => ec.id === examCallIds[0]) || null;
          if (examCall) groupKey = String(examCall.id);
        }
        
        if (!groupedByCall[groupKey]) {
          groupedByCall[groupKey] = { inscriptions: [], examSchedules: [], examCall };
        }
        groupedByCall[groupKey].inscriptions.push(inscription);
        for (const es of examSchedules) {
          if (!groupedByCall[groupKey].examSchedules.find(e => e.id === es.id)) {
            groupedByCall[groupKey].examSchedules.push(es);
          }
        }
      }
      
      const grouped = Object.values(groupedByCall).map(group => {
        const latestInscription = group.inscriptions.sort((a: any, b: any) => 
          new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        )[0];
        return {
          inscription: latestInscription,
          examSchedules: group.examSchedules,
          examCall: group.examCall,
        };
      });
      
      grouped.sort((a, b) => {
        const dateA = a.inscription.createdAt ? new Date(a.inscription.createdAt).getTime() : 0;
        const dateB = b.inscription.createdAt ? new Date(b.inscription.createdAt).getTime() : 0;
        return dateB - dateA;
      });
      
      res.json({
        student: {
          firstName: student.firstName,
          lastName: student.lastName,
          dni: student.dni,
          profesorado: student.profesorado,
          turno: student.turno,
        },
        inscriptions: grouped.map((group) => ({
          ...group,
          inscription: {
            id: group.inscription.id,
            examScheduleIds: group.inscription.examScheduleIds,
            examConditions: group.inscription.examConditions,
            status: group.inscription.status,
            permissionNumber: group.inscription.permissionNumber,
            createdAt: group.inscription.createdAt,
          },
        })),
      });
    } catch (error) {
      res.status(500).json({ message: "Error al buscar inscripción" });
    }
  });

  // Update inscription data
  app.patch("/api/inscriptions/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { firstName, lastName, dni, phone, email, profesorado, turno, year, examScheduleIds } = req.body;
      
      // Get existing inscription
      const inscription = await storage.getInscription(id);
      if (!inscription) {
        return res.status(404).json({ message: "Inscripción no encontrada" });
      }

      // Update student data
      const student = await storage.getStudent(inscription.studentId);
      if (!student) {
        return res.status(404).json({ message: "Estudiante no encontrado" });
      }

      // Update student information
      await storage.updateStudent(inscription.studentId, {
        firstName,
        lastName,
        dni,
        phone,
        email,
        profesorado,
        turno,
        year,
        division: req.body.division
      });

      // Update inscription exam schedules
      const updated = await storage.updateInscription(id, {
        examScheduleIds: examScheduleIds || []
      });

      if (!updated) {
        return res.status(404).json({ message: "Error al actualizar inscripción" });
      }
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating inscription:", error);
      res.status(500).json({ message: "Error al actualizar inscripción" });
    }
  });

  // Export inscriptions to Excel
  app.get("/api/inscriptions/export", requireAuth, async (req, res) => {
    try {
      const inscriptions = await storage.getAllInscriptions();
      
      // Get full inscription data with student and exam schedule details
      const fullInscriptions = await Promise.all(
        inscriptions.map(async (inscription) => {
          const student = await storage.getStudent(inscription.studentId);
          const examSchedules = await Promise.all(
            inscription.examScheduleIds.map(id => storage.getExamSchedule(parseInt(id)))
          );
          
          return {
            id: inscription.id,
            student,
            examSchedules: examSchedules.filter(Boolean),
            status: inscription.status,
            confirmedBy: inscription.confirmedBy,
            confirmedAt: inscription.confirmedAt,
            createdAt: inscription.createdAt
          };
        })
      );

      res.json(fullInscriptions);
    } catch (error) {
      res.status(500).json({ message: "Error al exportar inscripciones" });
    }
  });

  // Subjects API
  app.get("/api/subjects", async (req, res) => {
    try {
      const profesorado = req.query.profesorado as string;
      const year = req.query.year ? parseInt(req.query.year as string) : undefined;
      
      const subjectsList = await storage.getSubjects(profesorado, year);
      res.json(subjectsList);
    } catch (error) {
      console.error("Error getting subjects:", error);
      res.status(500).json({ error: "Error interno del servidor" });
    }
  });

  const createSubjectSchema = insertSubjectSchema.extend({
    name: z.string().trim().min(1, "El nombre de la materia es obligatorio"),
    profesorado: z.enum(["Educación Inicial", "Educación Primaria", "Biología"]),
    year: z.number().int().min(1).max(4),
  });

  app.post("/api/subjects", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const subjectData = createSubjectSchema.parse(req.body);
      const { subject, created } = await storage.createSubject(subjectData);
      res.status(created ? 201 : 200).json({ subject, created });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Datos de materia inválidos", details: error.issues });
      }
      console.error("Error creating subject:", error);
      res.status(500).json({ error: "Error interno del servidor" });
    }
  });

  app.patch("/api/subjects/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const subjectId = parseInt(req.params.id);
      if (isNaN(subjectId)) {
        return res.status(400).json({ error: "ID de materia inválido" });
      }
      const subjectData = createSubjectSchema.parse(req.body);
      const updated = await storage.updateSubject(subjectId, subjectData);
      if (!updated) {
        return res.status(404).json({ error: "Materia no encontrada" });
      }
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Datos de materia inválidos", details: error.issues });
      }
      console.error("Error updating subject:", error);
      res.status(500).json({ error: "Error interno del servidor" });
    }
  });

  app.delete("/api/subjects/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const subjectId = parseInt(req.params.id);
      if (isNaN(subjectId)) {
        return res.status(400).json({ error: "ID de materia inválido" });
      }
      const subject = await storage.getSubject(subjectId);
      if (!subject) {
        return res.status(404).json({ error: "Materia no encontrada" });
      }
      const force = req.query.force === "true";
      const examCount = await storage.countSubjectExamSchedules(subjectId);
      if (examCount > 0 && !force) {
        return res.status(409).json({
          error: "La materia tiene mesas de examen asociadas",
          examCount,
        });
      }
      await storage.deleteSubject(subjectId);
      res.json({ success: true, examCount });
    } catch (error) {
      console.error("Error deleting subject:", error);
      res.status(500).json({ error: "Error interno del servidor" });
    }
  });

  app.get("/api/subjects/:id/correlativities", async (req, res) => {
    try {
      const subjectId = parseInt(req.params.id);
      const correlativitiesList = await storage.getSubjectCorrelativities(subjectId);
      res.json(correlativitiesList);
    } catch (error) {
      console.error("Error getting correlativities:", error);
      res.status(500).json({ error: "Error interno del servidor" });
    }
  });

  // Statistics route
  app.get("/api/statistics", requireAuth, async (req, res) => {
    try {
      const students = await storage.getAllStudents();
      const examSchedules = await storage.getAllExamSchedules();
      const inscriptions = await storage.getAllInscriptions();

      const profesorados = Array.from(new Set(examSchedules.map(e => e.profesorado)));
      const subjects = Array.from(new Set(examSchedules.map(e => e.subject)));

      res.json({
        totalStudents: students.length,
        totalInscriptions: inscriptions.length,
        totalExamSchedules: examSchedules.length,
        totalProfesorados: profesorados.length,
        totalSubjects: subjects.length
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch statistics" });
    }
  });

  // Teachers routes
  app.get("/api/teachers", async (req, res) => {
    try {
      const teachers = await storage.getAllTeachers();
      // Format teachers with correct fullName from firstName and lastName
      const formattedTeachers = teachers.map(teacher => ({
        ...teacher,
        fullName: `${teacher.lastName}, ${teacher.firstName}`
      }));
      // Sort alphabetically by fullName
      formattedTeachers.sort((a, b) => a.fullName.localeCompare(b.fullName, 'es', { sensitivity: 'base' }));
      res.json(formattedTeachers);
    } catch (error) {
      res.status(500).json({ message: "Error al obtener docentes" });
    }
  });

  app.post("/api/teachers", requireAuth, async (req, res) => {
    try {
      const teacherData = req.body;
      const teacher = await storage.createTeacher(teacherData);
      res.status(201).json(teacher);
    } catch (error) {
      res.status(500).json({ message: "Error al crear docente" });
    }
  });

  // Maintenance mode routes
  app.get("/api/maintenance/status", async (req, res) => {
    try {
      const isActive = await storage.isMaintenanceModeActive();
      res.json({ maintenanceMode: isActive });
    } catch (error) {
      res.status(500).json({ message: "Error al verificar estado de mantenimiento" });
    }
  });

  app.post("/api/maintenance/toggle", requireSuperadmin, async (req: AuthenticatedRequest, res) => {
    try {
      const { enabled } = z.object({ enabled: z.boolean() }).strict().parse(req.body);
      await storage.setSystemSetting('maintenance_mode', enabled ? 'true' : 'false', req.user!.username);
      
      res.json({ 
        success: true, 
        maintenanceMode: enabled,
        message: enabled ? "Modo mantenimiento activado" : "Modo mantenimiento desactivado"
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Estado de mantenimiento inválido" });
      }
      res.status(500).json({ message: "Error al cambiar estado de mantenimiento" });
    }
  });

  // Permission counter routes
  app.get("/api/permission-counter/next", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const nextNumber = await storage.getNextPermissionNumber();
      res.json({ permissionNumber: nextNumber });
    } catch (error) {
      res.status(500).json({ message: "Error al obtener número de permiso" });
    }
  });

  // Statistics routes
  app.get("/api/statistics/inscriptions", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const statistics = await storage.getInscriptionStatistics();
      res.json(statistics);
    } catch (error) {
      res.status(500).json({ message: "Error al obtener estadísticas" });
    }
  });

  // Clone Julio 2025 exams to Diciembre 2025 (DISABLED - already executed)
  // This endpoint was used once to clone 185 exams from Julio 2025 to Diciembre 2025
  // It is now disabled to prevent accidental duplication
  /*
  app.post("/api/exam-schedules/clone-to-december", requireAuth, async (req, res) => {
    try {
      // Get all Julio 2025 exams
      const julyExams = await storage.getArchivedExamSchedules("Julio 2025");
      
      // Clone each exam to December 2025
      const clonedExams = [];
      for (const exam of julyExams) {
        const decemberExam = await storage.createExamSchedule({
          subject: exam.subject,
          year: exam.year,
          profesorado: exam.profesorado,
          turno: exam.turno,
          division: exam.division,
          date: "01/12/2025",
          time: exam.time,
          teacher: exam.teacher,
          presidente: exam.presidente,
          vocal1: exam.vocal1,
          vocal2: exam.vocal2,
          vocalSuplente: exam.vocalSuplente,
          period: "Diciembre 2025",
          registrationOpen: true
        });
        clonedExams.push(decemberExam);
      }
      
      res.json({ 
        message: `${clonedExams.length} mesas clonadas exitosamente`,
        count: clonedExams.length 
      });
    } catch (error: any) {
      res.status(500).json({ message: "Error al clonar mesas", error: error.message });
    }
  });
  */

  // Exam Calls routes
  app.get("/api/exam-calls", async (req, res) => {
    try {
      const examCalls = await storage.getAllExamCalls();
      res.json(examCalls);
    } catch (error) {
      res.status(500).json({ message: "Error al obtener llamados de examen" });
    }
  });

  app.get("/api/exam-calls/active", async (req, res) => {
    try {
      const activeCall = await storage.getActiveExamCall();
      res.json(activeCall || null);
    } catch (error) {
      res.status(500).json({ message: "Error al obtener llamado activo" });
    }
  });

  app.get("/api/exam-calls/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const examCall = await storage.getExamCall(id);
      
      if (!examCall) {
        return res.status(404).json({ message: "Llamado de examen no encontrado" });
      }
      
      res.json(examCall);
    } catch (error) {
      res.status(500).json({ message: "Error al obtener llamado de examen" });
    }
  });

  app.post("/api/exam-calls", requireAuth, async (req, res) => {
    try {
      const examCallData = insertExamCallSchema.parse(req.body);
      const examCall = await storage.createExamCall(examCallData);
      res.status(201).json(examCall);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Datos inválidos", errors: error.issues });
      } else {
        res.status(500).json({ message: "Error al crear llamado de examen" });
      }
    }
  });

  app.put("/api/exam-calls/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updateData = insertExamCallSchema.partial().parse(req.body);
      const updated = await storage.updateExamCall(id, updateData);
      
      if (!updated) {
        return res.status(404).json({ message: "Llamado de examen no encontrado" });
      }
      
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Datos inválidos", errors: error.issues });
      } else {
        res.status(500).json({ message: "Error al actualizar llamado de examen" });
      }
    }
  });

  app.patch("/api/exam-calls/:id/activate", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const activated = await storage.setActiveExamCall(id);
      
      if (!activated) {
        return res.status(404).json({ message: "Llamado de examen no encontrado" });
      }
      
      res.json(activated);
    } catch (error) {
      res.status(500).json({ message: "Error al activar llamado de examen" });
    }
  });

  app.delete("/api/exam-calls/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteExamCall(id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Llamado de examen no encontrado" });
      }
      
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Error al eliminar llamado de examen" });
    }
  });

  // Get exam schedules by exam call
  app.get("/api/exam-calls/:id/schedules", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const schedules = await storage.getExamSchedulesByExamCallId(id);
      res.json(schedules);
    } catch (error) {
      res.status(500).json({ message: "Error al obtener mesas del llamado" });
    }
  });

  // Clone exam call with all its schedules
  app.post("/api/exam-calls/:id/clone", requireAuth, async (req, res) => {
    try {
      const sourceId = parseInt(req.params.id);
      const { name, startDate, endDate } = req.body;
      
      if (!name || !startDate || !endDate) {
        return res.status(400).json({ message: "Nombre, fecha de inicio y fecha de fin son requeridos" });
      }
      
      const result = await storage.cloneExamCall(sourceId, { name, startDate, endDate });
      if (!result) {
        return res.status(404).json({ message: "Llamado de examen origen no encontrado" });
      }
      res.status(201).json(result);
    } catch (error: any) {
      console.error("Error cloning exam call:", error);
      res.status(500).json({ message: "Error al clonar llamado de examen" });
    }
  });

}
