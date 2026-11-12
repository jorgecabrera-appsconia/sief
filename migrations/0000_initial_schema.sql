CREATE TABLE "admin_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"role" text DEFAULT 'admin' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "admin_users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "correlativities" (
	"id" serial PRIMARY KEY NOT NULL,
	"subject_id" integer NOT NULL,
	"prerequisite_subject_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "exam_calls" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"start_date" text,
	"end_date" text,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "exam_schedules" (
	"id" serial PRIMARY KEY NOT NULL,
	"subject" text NOT NULL,
	"year" integer NOT NULL,
	"profesorado" text NOT NULL,
	"turno" text NOT NULL,
	"division" text DEFAULT 'A' NOT NULL,
	"date" text NOT NULL,
	"time" text NOT NULL,
	"teacher" text NOT NULL,
	"presidente" text NOT NULL,
	"vocal1" text NOT NULL,
	"vocal2" text NOT NULL,
	"vocal_suplente" text NOT NULL,
	"period" text DEFAULT 'Julio 2025' NOT NULL,
	"registration_open" boolean DEFAULT false NOT NULL,
	"exam_call_id" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "inscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" integer NOT NULL,
	"exam_schedule_ids" text[] NOT NULL,
	"exam_conditions" text[],
	"status" text DEFAULT 'pending',
	"confirmed_by" text,
	"confirmed_at" timestamp,
	"permission_number" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "maintenance_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"maintenance_mode" boolean DEFAULT false NOT NULL,
	"last_updated_by" text,
	"last_updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "permission_counter" (
	"id" serial PRIMARY KEY NOT NULL,
	"current_number" integer DEFAULT 0 NOT NULL,
	"last_updated" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "rate_limit_buckets" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "students" (
	"id" serial PRIMARY KEY NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"dni" text NOT NULL,
	"phone" text NOT NULL,
	"email" text NOT NULL,
	"profesorado" text NOT NULL,
	"turno" text NOT NULL,
	"year" integer NOT NULL,
	"division" text DEFAULT 'A' NOT NULL,
	"year_entered" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "subjects" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"profesorado" text NOT NULL,
	"year" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"updated_by" text,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "system_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "teachers" (
	"id" serial PRIMARY KEY NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"full_name" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "correlativities" ADD CONSTRAINT "correlativities_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "correlativities" ADD CONSTRAINT "correlativities_prerequisite_subject_id_subjects_id_fk" FOREIGN KEY ("prerequisite_subject_id") REFERENCES "public"."subjects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_schedules" ADD CONSTRAINT "exam_schedules_exam_call_id_exam_calls_id_fk" FOREIGN KEY ("exam_call_id") REFERENCES "public"."exam_calls"("id") ON DELETE no action ON UPDATE no action;