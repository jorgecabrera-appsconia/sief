import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Exam Calls - Grupos de mesas de examen por período
export const examCalls = pgTable("exam_calls", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(), // ej: "Primer Llamado - Noviembre 2025"
  description: text("description"), // descripción opcional
  startDate: text("start_date"), // fecha de inicio del período
  endDate: text("end_date"), // fecha de fin del período
  isActive: boolean("is_active").default(false).notNull(), // si está activo el llamado
  createdAt: timestamp("created_at").defaultNow(),
});

export const students = pgTable("students", {
  id: serial("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  dni: text("dni").notNull(),
  phone: text("phone").notNull(),
  email: text("email").notNull(),
  profesorado: text("profesorado").notNull(),
  turno: text("turno").notNull(), // mañana, siesta, tarde
  year: integer("year").notNull(), // 1, 2, 3, 4
  division: text("division").default("A").notNull(), // A, B, C, D
  yearEntered: integer("year_entered"), // año de ingreso al profesorado
  createdAt: timestamp("created_at").defaultNow(),
});

export const examSchedules = pgTable("exam_schedules", {
  id: serial("id").primaryKey(),
  subject: text("subject").notNull(),
  year: integer("year").notNull(),
  profesorado: text("profesorado").notNull(),
  turno: text("turno").notNull(), // mañana, siesta, tarde
  division: text("division").default("A").notNull(), // A, B, C, D
  date: text("date").notNull(),
  time: text("time").notNull(),
  teacher: text("teacher").notNull(),
  presidente: text("presidente").notNull(),
  vocal1: text("vocal1").notNull(),
  vocal2: text("vocal2").notNull(),
  vocalSuplente: text("vocal_suplente").notNull(),
  period: text("period").default("Julio 2025").notNull(), // período de exámenes (legacy, ahora usar examCallId)
  registrationOpen: boolean("registration_open").default(false).notNull(), // si está abierta la inscripción
  examCallId: integer("exam_call_id").references(() => examCalls.id), // referencia al llamado de examen
  createdAt: timestamp("created_at").defaultNow(),
});

export const inscriptions = pgTable("inscriptions", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull(),
  examScheduleIds: text("exam_schedule_ids").array().notNull(),
  examConditions: text("exam_conditions").array(), // Array paralelo con condiciones: "regular" o "libre" para cada mesa
  status: text("status").default("pending"),
  confirmedBy: text("confirmed_by"),
  confirmedAt: timestamp("confirmed_at"),
  permissionNumber: integer("permission_number"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const adminUsers = pgTable("admin_users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("admin"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const subjects = pgTable("subjects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  profesorado: text("profesorado").notNull(),
  year: integer("year").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const correlativities = pgTable("correlativities", {
  id: serial("id").primaryKey(),
  subjectId: integer("subject_id").notNull().references(() => subjects.id),
  prerequisiteSubjectId: integer("prerequisite_subject_id").notNull().references(() => subjects.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const teachers = pgTable("teachers", {
  id: serial("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  fullName: text("full_name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const systemSettings = pgTable("system_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const rateLimitBuckets = pgTable("rate_limit_buckets", {
  key: text("key").primaryKey(),
  count: integer("count").default(1).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
});

export const insertExamCallSchema = createInsertSchema(examCalls).omit({
  id: true,
  createdAt: true,
});

export const insertStudentSchema = createInsertSchema(students).omit({
  id: true,
  createdAt: true,
});

export const insertExamScheduleSchema = createInsertSchema(examSchedules).omit({
  id: true,
  createdAt: true,
});

export const insertInscriptionSchema = createInsertSchema(inscriptions).omit({
  id: true,
  createdAt: true,
});

export const insertAdminUserSchema = createInsertSchema(adminUsers).omit({
  id: true,
  createdAt: true,
});

export const insertSubjectSchema = createInsertSchema(subjects).omit({
  id: true,
  createdAt: true,
});

export const insertCorrelativitySchema = createInsertSchema(correlativities).omit({
  id: true,
  createdAt: true,
});

export const insertTeacherSchema = createInsertSchema(teachers).omit({
  id: true,
  createdAt: true,
});

export const insertSystemSettingSchema = createInsertSchema(systemSettings).omit({
  id: true,
  updatedAt: true,
});

export type InsertExamCall = z.infer<typeof insertExamCallSchema>;
export type ExamCall = typeof examCalls.$inferSelect;

export type InsertStudent = z.infer<typeof insertStudentSchema>;
export type Student = typeof students.$inferSelect;

export type InsertExamSchedule = z.infer<typeof insertExamScheduleSchema>;
export type ExamSchedule = typeof examSchedules.$inferSelect;

export type InsertInscription = z.infer<typeof insertInscriptionSchema>;
export type Inscription = typeof inscriptions.$inferSelect;

export type InsertAdminUser = z.infer<typeof insertAdminUserSchema>;
export type AdminUser = typeof adminUsers.$inferSelect;

export type InsertSubject = z.infer<typeof insertSubjectSchema>;
export type Subject = typeof subjects.$inferSelect;

export type InsertCorrelativity = z.infer<typeof insertCorrelativitySchema>;
export type Correlativity = typeof correlativities.$inferSelect;

export type InsertTeacher = z.infer<typeof insertTeacherSchema>;
export type Teacher = typeof teachers.$inferSelect;

// Maintenance mode configuration
export const maintenanceConfig = pgTable('maintenance_config', {
  id: serial('id').primaryKey(),
  maintenanceMode: boolean('maintenance_mode').default(false).notNull(),
  lastUpdatedBy: text('last_updated_by'),
  lastUpdatedAt: timestamp('last_updated_at').defaultNow()
});

// Permission slips numbering counter
export const permissionCounter = pgTable('permission_counter', {
  id: serial('id').primaryKey(),
  currentNumber: integer('current_number').default(0).notNull(),
  lastUpdated: timestamp('last_updated').defaultNow()
});

export type MaintenanceConfig = typeof maintenanceConfig.$inferSelect;
export type PermissionCounter = typeof permissionCounter.$inferSelect;

export type InsertSystemSetting = z.infer<typeof insertSystemSettingSchema>;
export type SystemSetting = typeof systemSettings.$inferSelect;
