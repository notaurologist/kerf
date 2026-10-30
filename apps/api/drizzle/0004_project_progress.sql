CREATE TABLE "project_progress" (
	"project_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"key" text NOT NULL,
	"done_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_progress_project_id_kind_key_pk" PRIMARY KEY("project_id","kind","key"),
	CONSTRAINT "project_progress_kind" CHECK ("project_progress"."kind" in ('shopping-line', 'board', 'part', 'step'))
);
--> statement-breakpoint
ALTER TABLE "project_progress" ADD CONSTRAINT "project_progress_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;