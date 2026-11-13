CREATE TABLE "admin_user_audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor_user_id" integer NOT NULL,
	"actor_username" text NOT NULL,
	"target_user_id" integer,
	"target_username" text NOT NULL,
	"action" text NOT NULL,
	"changes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN "must_change_password" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN "session_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN "updated_at" timestamp DEFAULT now();