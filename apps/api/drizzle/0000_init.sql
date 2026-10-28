CREATE TABLE "login_attempts" (
	"window_start" timestamp with time zone PRIMARY KEY NOT NULL,
	"failures" integer NOT NULL,
	CONSTRAINT "login_attempts_failures" CHECK ("login_attempts"."failures" > 0)
);
--> statement-breakpoint
CREATE TABLE "project_history" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "project_history_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"project_id" uuid NOT NULL,
	"operation" text NOT NULL,
	"method_id" text NOT NULL,
	"skills" text[] DEFAULT '{}'::text[] NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"status" text NOT NULL,
	"template_id" text NOT NULL,
	"template_version" integer NOT NULL,
	"params" jsonb NOT NULL,
	"structural_inputs" jsonb NOT NULL,
	"snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_status" CHECK ("projects"."status" in ('planned', 'in-progress', 'built')),
	CONSTRAINT "projects_name" CHECK (length(trim("projects"."name")) > 0),
	CONSTRAINT "projects_template_version" CHECK ("projects"."template_version" > 0)
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "sessions_expires_after_created" CHECK ("sessions"."expires_at" > "sessions"."created_at")
);
--> statement-breakpoint
CREATE TABLE "tools" (
	"tool_type_id" text PRIMARY KEY NOT NULL,
	"capabilities" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_history" ADD CONSTRAINT "project_history_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_history_project_id" ON "project_history" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "projects_updated_at" ON "projects" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "sessions_expires_at" ON "sessions" USING btree ("expires_at");