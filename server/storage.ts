import { students, examSchedules, inscriptions, adminUsers, subjects, correlativities, teachers, systemSettings, permissionCounter, examCalls, rateLimitBuckets, type Student, type InsertStudent, type ExamSchedule, type InsertExamSchedule, type Inscription, type InsertInscription, type AdminUser, type InsertAdminUser, type Subject, type InsertSubject, type Teacher, type InsertTeacher, type SystemSetting, type InsertSystemSetting, type ExamCall, type InsertExamCall } from "@shared/schema";
import { morningExamSchedules } from './exam-schedules-data';
import { db } from "./db";
import { eq, and, sql, isNotNull, ilike, inArray } from "drizzle-orm";
import { evaluatePassword, hashPassword } from "./security";

export interface IStorage {
  // Student operations
  getStudent(id: number): Promise<Student | undefined>;
  getStudentByDni(dni: string): Promise<Student | undefined>;
  createStudent(student: InsertStudent): Promise<Student>;
  getAllStudents(): Promise<Student[]>;
  updateStudent(id: number, student: Partial<InsertStudent>): Promise<Student | undefined>;

  // Exam schedule operations
  getExamSchedule(id: number): Promise<ExamSchedule | undefined>;
  createExamSchedule(examSchedule: InsertExamSchedule): Promise<ExamSchedule>;
  getAllExamSchedules(): Promise<ExamSchedule[]>;
  updateExamSchedule(id: number, examSchedule: Partial<InsertExamSchedule>): Promise<ExamSchedule | undefined>;
  deleteExamSchedule(id: number): Promise<boolean>;
  getExamSchedulesByFilters(profesorado?: string, turno?: string, registrationOpen?: boolean, period?: string): Promise<ExamSchedule[]>;
  getOpenExamSchedules(): Promise<ExamSchedule[]>;
  getArchivedExamSchedules(period: string): Promise<ExamSchedule[]>;

  // Inscription operations
  getInscription(id: number): Promise<Inscription | undefined>;
  createInscription(inscription: InsertInscription): Promise<Inscription>;
  getAllInscriptions(): Promise<Inscription[]>;
  getInscriptionsByExamCallId(examCallId: number): Promise<Inscription[]>;
  getInscriptionsByStudent(studentId: number): Promise<Inscription[]>;
  updateInscriptionStatus(id: number, status: string, confirmedBy?: string): Promise<Inscription | undefined>;
  updateInscription(id: number, inscription: Partial<InsertInscription>): Promise<Inscription | undefined>;
  createPublicRegistration(input: PublicRegistrationInput): Promise<{
    student: Student;
    inscription: Inscription;
  }>;

  // Admin operations
  getAdminUser(username: string): Promise<AdminUser | undefined>;
  createAdminUser(adminUser: InsertAdminUser): Promise<AdminUser>;
  validateAdminCredentials(username: string, password: string): Promise<AdminUser | null>;

  // Subject operations
  getSubjects(profesorado?: string, year?: number): Promise<Subject[]>;
  getSubjectCorrelativities(subjectId: number): Promise<Subject[]>;
  createSubject(subject: InsertSubject): Promise<{ subject: Subject; created: boolean }>;
  getSubject(id: number): Promise<Subject | undefined>;
  countSubjectExamSchedules(id: number): Promise<number>;
  updateSubject(id: number, subject: InsertSubject): Promise<Subject | undefined>;
  deleteSubject(id: number): Promise<boolean>;

  // Teacher operations
  getAllTeachers(): Promise<Teacher[]>;
  createTeacher(teacher: InsertTeacher): Promise<Teacher>;

  // System settings operations
  getSystemSetting(key: string): Promise<SystemSetting | undefined>;
  setSystemSetting(key: string, value: string, updatedBy: string): Promise<SystemSetting>;
  isMaintenanceModeActive(): Promise<boolean>;
  
  // Permission counter operations
  getNextPermissionNumber(): Promise<number>;
  
  // Statistics operations
  getInscriptionStatistics(): Promise<any>;

  // Shared serverless rate limit operations
  consumeRateLimit(key: string, expiresAt: Date): Promise<number>;

  // Exam Call operations
  getAllExamCalls(): Promise<ExamCall[]>;
  getExamCall(id: number): Promise<ExamCall | undefined>;
  getActiveExamCall(): Promise<ExamCall | undefined>;
  createExamCall(examCall: InsertExamCall): Promise<ExamCall>;
  updateExamCall(id: number, examCall: Partial<InsertExamCall>): Promise<ExamCall | undefined>;
  deleteExamCall(id: number): Promise<boolean>;
  setActiveExamCall(id: number): Promise<ExamCall | undefined>;
  getExamSchedulesByExamCallId(examCallId: number): Promise<ExamSchedule[]>;
}

export interface PublicRegistrationInput {
  student: InsertStudent;
  examScheduleIds: string[];
  examConditions: Array<"regular" | "libre">;
}

export class RegistrationError extends Error {
  constructor(
    public readonly code:
      | "CONTACT_MISMATCH"
      | "INVALID_EXAMS"
      | "DUPLICATE_REGISTRATION",
    message: string,
  ) {
    super(message);
  }
}

export class DatabaseStorage implements IStorage {
  async getStudent(id: number): Promise<Student | undefined> {
    const [user] = await db.select().from(students).where(eq(students.id, id));
    return user || undefined;
  }

  async getStudentByDni(dni: string): Promise<Student | undefined> {
    const [user] = await db.select().from(students).where(eq(students.dni, dni));
    return user || undefined;
  }

  async createStudent(insertStudent: InsertStudent): Promise<Student> {
    const [user] = await db
      .insert(students)
      .values(insertStudent)
      .returning();
    return user;
  }

  async getAllStudents(): Promise<Student[]> {
    return await db.select().from(students);
  }

  async updateStudent(id: number, updateData: Partial<InsertStudent>): Promise<Student | undefined> {
    const [updated] = await db
      .update(students)
      .set(updateData)
      .where(eq(students.id, id))
      .returning();
    return updated || undefined;
  }

  async getExamSchedule(id: number): Promise<ExamSchedule | undefined> {
    const [schedule] = await db.select().from(examSchedules).where(eq(examSchedules.id, id));
    return schedule || undefined;
  }

  async createExamSchedule(insertExamSchedule: InsertExamSchedule): Promise<ExamSchedule> {
    const [schedule] = await db
      .insert(examSchedules)
      .values(insertExamSchedule)
      .returning();
    return schedule;
  }

  async getAllExamSchedules(): Promise<ExamSchedule[]> {
    return await db.select().from(examSchedules)
      .orderBy(examSchedules.year, examSchedules.subject);
  }

  async updateExamSchedule(id: number, updateData: Partial<InsertExamSchedule>): Promise<ExamSchedule | undefined> {
    const [updated] = await db
      .update(examSchedules)
      .set(updateData)
      .where(eq(examSchedules.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteExamSchedule(id: number): Promise<boolean> {
    const result = await db.delete(examSchedules).where(eq(examSchedules.id, id));
    return (result.rowCount || 0) > 0;
  }

  async getExamSchedulesByFilters(profesorado?: string, turno?: string, registrationOpen?: boolean, period?: string): Promise<ExamSchedule[]> {
    const conditions = [];
    
    if (profesorado) {
      conditions.push(eq(examSchedules.profesorado, profesorado));
    }
    if (turno) {
      conditions.push(eq(examSchedules.turno, turno));
    }
    if (registrationOpen !== undefined) {
      conditions.push(eq(examSchedules.registrationOpen, registrationOpen));
    }
    if (period) {
      conditions.push(eq(examSchedules.period, period));
    }
    
    if (conditions.length > 0) {
      return await db.select().from(examSchedules)
        .where(and(...conditions))
        .orderBy(examSchedules.year, examSchedules.subject);
    }
    
    return await db.select().from(examSchedules)
      .orderBy(examSchedules.year, examSchedules.subject);
  }

  async getOpenExamSchedules(): Promise<ExamSchedule[]> {
    const allOpen = await db.select().from(examSchedules)
      .where(eq(examSchedules.registrationOpen, true))
      .orderBy(examSchedules.year, examSchedules.subject);

    const activeCall = await this.getActiveExamCall();
    if (!activeCall) return allOpen;

    return allOpen.filter(exam => {
      const matchesById = exam.examCallId != null && exam.examCallId === activeCall.id;
      const matchesByDate =
        activeCall.startDate &&
        activeCall.endDate &&
        exam.date &&
        exam.date >= activeCall.startDate &&
        exam.date <= activeCall.endDate;
      return matchesById || matchesByDate;
    });
  }

  async getArchivedExamSchedules(period: string): Promise<ExamSchedule[]> {
    return await db.select().from(examSchedules)
      .where(and(
        eq(examSchedules.period, period),
        eq(examSchedules.registrationOpen, false)
      ))
      .orderBy(examSchedules.year, examSchedules.subject);
  }

  async getInscription(id: number): Promise<Inscription | undefined> {
    const [inscription] = await db.select().from(inscriptions).where(eq(inscriptions.id, id));
    return inscription || undefined;
  }

  async createInscription(insertInscription: InsertInscription): Promise<Inscription> {
    const [inscription] = await db
      .insert(inscriptions)
      .values({
        ...insertInscription,
        status: 'pending',
        confirmedBy: null,
        confirmedAt: null
      })
      .returning();
    return inscription;
  }

  async getAllInscriptions(): Promise<Inscription[]> {
    return await db.select().from(inscriptions);
  }

  async getInscriptionsByExamCallId(examCallId: number): Promise<Inscription[]> {
    const allExamSchedulesInCall = await db.select({ id: examSchedules.id })
      .from(examSchedules)
      .where(eq(examSchedules.examCallId, examCallId));
    const examIdsInCall = new Set(allExamSchedulesInCall.map(e => e.id.toString()));

    const all = await db.select().from(inscriptions);
    return all.filter(inscription =>
      inscription.examScheduleIds.some(id => examIdsInCall.has(id))
    );
  }

  async getInscriptionsByStudent(studentId: number): Promise<Inscription[]> {
    return await db.select().from(inscriptions).where(eq(inscriptions.studentId, studentId));
  }

  async updateInscriptionStatus(id: number, status: string, confirmedBy?: string): Promise<Inscription | undefined> {
    let permissionNumber = null;
    
    // If confirming, assign next sequential permission number
    if (status === 'confirmed') {
      const maxPermissionResult = await db
        .select({ maxNumber: sql<number>`MAX(${inscriptions.permissionNumber})` })
        .from(inscriptions)
        .where(isNotNull(inscriptions.permissionNumber));
      
      const maxNumber = maxPermissionResult[0]?.maxNumber || 0;
      permissionNumber = maxNumber + 1;
    }
    
    const [updated] = await db
      .update(inscriptions)
      .set({
        status: status,
        confirmedBy: confirmedBy || null,
        confirmedAt: status !== 'pending' ? new Date() : null,
        permissionNumber
      })
      .where(eq(inscriptions.id, id))
      .returning();
    return updated || undefined;
  }

  async updateInscription(id: number, updateData: Partial<InsertInscription>): Promise<Inscription | undefined> {
    const [updated] = await db
      .update(inscriptions)
      .set(updateData)
      .where(eq(inscriptions.id, id))
      .returning();
    return updated || undefined;
  }

  async createPublicRegistration(input: PublicRegistrationInput) {
    return db.transaction(async (tx) => {
      // Serialize registrations for the same DNI. This prevents two concurrent
      // requests from both creating a student or bypassing the one-per-call rule.
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtextextended(${input.student.dni}, 0))`,
      );

      const numericExamIds = input.examScheduleIds.map(Number);
      const selectedExams = await tx
        .select()
        .from(examSchedules)
        .where(inArray(examSchedules.id, numericExamIds));
      const [activeCall] = await tx
        .select()
        .from(examCalls)
        .where(eq(examCalls.isActive, true))
        .limit(1);

      if (
        !activeCall ||
        selectedExams.length !== numericExamIds.length ||
        selectedExams.some(
          (exam) => !exam.registrationOpen || exam.examCallId !== activeCall.id,
        )
      ) {
        throw new RegistrationError(
          "INVALID_EXAMS",
          "Una o más mesas no están disponibles para inscripción",
        );
      }

      const [existingStudent] = await tx
        .select()
        .from(students)
        .where(eq(students.dni, input.student.dni))
        .limit(1);

      let student: Student;
      if (existingStudent) {
        const normalizedPhone = (value: string) => value.replace(/\D/g, "");
        const contactMatches =
          existingStudent.email.trim().toLowerCase() ===
            input.student.email.trim().toLowerCase() &&
          normalizedPhone(existingStudent.phone) ===
            normalizedPhone(input.student.phone);
        if (!contactMatches) {
          throw new RegistrationError(
            "CONTACT_MISMATCH",
            "Los datos de contacto no coinciden con el registro existente",
          );
        }

        const [updated] = await tx
          .update(students)
          .set(input.student)
          .where(eq(students.id, existingStudent.id))
          .returning();
        student = updated;
      } else {
        [student] = await tx.insert(students).values(input.student).returning();
      }

      const activeExamIds = new Set(
        (
          await tx
            .select({ id: examSchedules.id })
            .from(examSchedules)
            .where(eq(examSchedules.examCallId, activeCall.id))
        ).map((exam) => String(exam.id)),
      );
      const existingInscriptions = await tx
        .select()
        .from(inscriptions)
        .where(eq(inscriptions.studentId, student.id));
      if (
        existingInscriptions.some((inscription) =>
          inscription.examScheduleIds.some((id) => activeExamIds.has(id)),
        )
      ) {
        throw new RegistrationError(
          "DUPLICATE_REGISTRATION",
          "Ya existe una inscripción para el llamado activo",
        );
      }

      const [inscription] = await tx
        .insert(inscriptions)
        .values({
          studentId: student.id,
          examScheduleIds: input.examScheduleIds,
          examConditions: input.examConditions,
          status: "pending",
          confirmedBy: null,
          confirmedAt: null,
          permissionNumber: null,
        })
        .returning();

      return { student, inscription };
    });
  }

  async getAdminUser(username: string): Promise<AdminUser | undefined> {
    const [user] = await db.select().from(adminUsers).where(eq(adminUsers.username, username));
    return user || undefined;
  }

  async createAdminUser(insertAdminUser: InsertAdminUser): Promise<AdminUser> {
    const [user] = await db
      .insert(adminUsers)
      .values({
        ...insertAdminUser,
        password: await hashPassword(insertAdminUser.password),
      })
      .returning();
    return user;
  }

  async validateAdminCredentials(username: string, password: string): Promise<AdminUser | null> {
    const user = await this.getAdminUser(username);
    if (!user) {
      return null;
    }
    const evaluation = await evaluatePassword(password, user.password);
    if (!evaluation.valid) return null;
    if (evaluation.upgradedHash) {
      await db
        .update(adminUsers)
        .set({ password: evaluation.upgradedHash })
        .where(eq(adminUsers.id, user.id));
    }
    return user;
  }

  // Subject operations
  async getSubjects(profesorado?: string, year?: number): Promise<Subject[]> {
    let query = db.select().from(subjects);
    
    if (profesorado && year) {
      return await query.where(and(eq(subjects.profesorado, profesorado), eq(subjects.year, year)));
    } else if (profesorado) {
      return await query.where(eq(subjects.profesorado, profesorado));
    } else if (year) {
      return await query.where(eq(subjects.year, year));
    }
    
    return await query;
  }

  async createSubject(subject: InsertSubject): Promise<{ subject: Subject; created: boolean }> {
    const name = subject.name.trim();
    const profesorado = subject.profesorado;

    // Avoid duplicates by name + profesorado (same rule used by the seeder).
    const existing = await db
      .select()
      .from(subjects)
      .where(and(eq(subjects.profesorado, profesorado), ilike(subjects.name, name)));

    if (existing.length > 0) {
      return { subject: existing[0], created: false };
    }

    const [created] = await db
      .insert(subjects)
      .values({ ...subject, name })
      .returning();

    return { subject: created, created: true };
  }

  async getSubject(id: number): Promise<Subject | undefined> {
    const [subject] = await db.select().from(subjects).where(eq(subjects.id, id));
    return subject;
  }

  async countSubjectExamSchedules(id: number): Promise<number> {
    const subject = await this.getSubject(id);
    if (!subject) return 0;

    const [result] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(examSchedules)
      .where(and(
        ilike(examSchedules.subject, subject.name),
        eq(examSchedules.profesorado, subject.profesorado),
      ));

    return Number(result?.count ?? 0);
  }

  async updateSubject(id: number, subject: InsertSubject): Promise<Subject | undefined> {
    const existing = await this.getSubject(id);
    if (!existing) return undefined;

    const name = subject.name.trim();

    const [updated] = await db
      .update(subjects)
      .set({ name, profesorado: subject.profesorado, year: subject.year })
      .where(eq(subjects.id, id))
      .returning();

    // Keep exam schedules (mesas) consistent when the materia is renamed or
    // moved to another profesorado, since they reference the subject by name.
    if (existing.name !== name || existing.profesorado !== subject.profesorado) {
      await db
        .update(examSchedules)
        .set({ subject: name, profesorado: subject.profesorado })
        .where(and(
          ilike(examSchedules.subject, existing.name),
          eq(examSchedules.profesorado, existing.profesorado),
        ));
    }

    return updated;
  }

  async deleteSubject(id: number): Promise<boolean> {
    const existing = await this.getSubject(id);
    if (!existing) return false;

    // Remove correlativities referencing this subject (either side) to avoid
    // foreign key violations.
    await db
      .delete(correlativities)
      .where(eq(correlativities.subjectId, id));
    await db
      .delete(correlativities)
      .where(eq(correlativities.prerequisiteSubjectId, id));

    await db.delete(subjects).where(eq(subjects.id, id));
    return true;
  }

  async getSubjectCorrelativities(subjectId: number): Promise<Subject[]> {
    const correlativitiesResult = await db
      .select({ prerequisiteSubjectId: correlativities.prerequisiteSubjectId })
      .from(correlativities)
      .where(eq(correlativities.subjectId, subjectId));
    
    if (correlativitiesResult.length === 0) {
      return [];
    }
    
    const prerequisiteIds = correlativitiesResult.map(c => c.prerequisiteSubjectId);
    
    // Get all prerequisite subjects
    const prerequisiteSubjects = await Promise.all(
      prerequisiteIds.map(async (id) => {
        const [subject] = await db.select().from(subjects).where(eq(subjects.id, id));
        return subject;
      })
    );
    
    return prerequisiteSubjects.filter(Boolean);
  }

  async getAllTeachers(): Promise<Teacher[]> {
    try {
      return await db.select().from(teachers);
    } catch (error) {
      console.error("Error getting teachers:", error);
      return [];
    }
  }

  async createTeacher(insertTeacher: InsertTeacher): Promise<Teacher> {
    const [teacher] = await db
      .insert(teachers)
      .values(insertTeacher)
      .returning();
    return teacher;
  }

  // System settings operations
  async getSystemSetting(key: string): Promise<SystemSetting | undefined> {
    const [setting] = await db.select().from(systemSettings).where(eq(systemSettings.key, key));
    return setting || undefined;
  }

  async setSystemSetting(key: string, value: string, updatedBy: string): Promise<SystemSetting> {
    try {
      // Try to update existing setting
      const [updated] = await db
        .update(systemSettings)
        .set({ value, updatedBy, updatedAt: new Date() })
        .where(eq(systemSettings.key, key))
        .returning();
      
      if (updated) {
        return updated;
      }
    } catch (error) {
      // Setting doesn't exist, create it
    }
    
    // Create new setting
    const [created] = await db
      .insert(systemSettings)
      .values({ key, value, updatedBy })
      .returning();
    return created;
  }

  async isMaintenanceModeActive(): Promise<boolean> {
    const setting = await this.getSystemSetting('maintenance_mode');
    return setting ? setting.value === 'true' : false;
  }

  async getNextPermissionNumber(): Promise<number> {
    return db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(73194621)`);
      const [counter] = await tx.select().from(permissionCounter).limit(1);

      if (!counter) {
        const [created] = await tx
          .insert(permissionCounter)
          .values({ currentNumber: 1 })
          .returning();
        return created.currentNumber;
      }

      const [updated] = await tx
        .update(permissionCounter)
        .set({
          currentNumber: sql`${permissionCounter.currentNumber} + 1`,
          lastUpdated: new Date(),
        })
        .where(eq(permissionCounter.id, counter.id))
        .returning();
      return updated.currentNumber;
    });
  }

  async consumeRateLimit(key: string, expiresAt: Date): Promise<number> {
    const [bucket] = await db
      .insert(rateLimitBuckets)
      .values({ key, count: 1, expiresAt })
      .onConflictDoUpdate({
        target: rateLimitBuckets.key,
        set: { count: sql`${rateLimitBuckets.count} + 1` },
      })
      .returning({ count: rateLimitBuckets.count });
    return bucket.count;
  }

  async getInscriptionStatistics(): Promise<any> {
    const result = await db.execute(sql`
      SELECT 
        s.profesorado,
        s.turno,
        CAST(s.year AS INTEGER) as year,
        es.subject,
        CAST(COUNT(DISTINCT i.student_id) AS INTEGER) as student_count,
        CAST(COUNT(CASE WHEN i.status = 'confirmed' THEN 1 END) AS INTEGER) as confirmed_count,
        CAST(COUNT(CASE WHEN i.status = 'pending' THEN 1 END) AS INTEGER) as pending_count,
        CAST(COUNT(CASE WHEN i.status = 'rejected' THEN 1 END) AS INTEGER) as rejected_count
      FROM inscriptions i
      JOIN students s ON i.student_id = s.id
      JOIN exam_schedules es ON es.id = ANY(
        ARRAY(SELECT CAST(unnest(i.exam_schedule_ids) AS INTEGER))
      )
      GROUP BY s.profesorado, s.turno, s.year, es.subject
      ORDER BY s.profesorado, s.turno, s.year, es.subject
    `);
    
    return result.rows;
  }

  // Exam Call operations
  async getAllExamCalls(): Promise<ExamCall[]> {
    return await db.select().from(examCalls).orderBy(examCalls.createdAt);
  }

  async getExamCall(id: number): Promise<ExamCall | undefined> {
    const [examCall] = await db.select().from(examCalls).where(eq(examCalls.id, id));
    return examCall || undefined;
  }

  async getActiveExamCall(): Promise<ExamCall | undefined> {
    const [examCall] = await db.select().from(examCalls).where(eq(examCalls.isActive, true));
    return examCall || undefined;
  }

  async createExamCall(insertExamCall: InsertExamCall): Promise<ExamCall> {
    const [examCall] = await db
      .insert(examCalls)
      .values(insertExamCall)
      .returning();
    return examCall;
  }

  async updateExamCall(id: number, updateData: Partial<InsertExamCall>): Promise<ExamCall | undefined> {
    const [updated] = await db
      .update(examCalls)
      .set(updateData)
      .where(eq(examCalls.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteExamCall(id: number): Promise<boolean> {
    const result = await db.delete(examCalls).where(eq(examCalls.id, id));
    return (result.rowCount || 0) > 0;
  }

  async setActiveExamCall(id: number): Promise<ExamCall | undefined> {
    // First, deactivate all exam calls
    await db.update(examCalls).set({ isActive: false });
    
    // Then activate the specified one
    const [activated] = await db
      .update(examCalls)
      .set({ isActive: true })
      .where(eq(examCalls.id, id))
      .returning();
    
    return activated || undefined;
  }

  async getExamSchedulesByExamCallId(examCallId: number): Promise<ExamSchedule[]> {
    return await db.select().from(examSchedules)
      .where(eq(examSchedules.examCallId, examCallId))
      .orderBy(examSchedules.year, examSchedules.subject);
  }
}

export const storage = new DatabaseStorage();
