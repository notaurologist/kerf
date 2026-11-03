CREATE TABLE "project_resets" (
	"project_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"key" text NOT NULL,
	"record" jsonb NOT NULL,
	"reset_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_resets_project_id_kind_key_pk" PRIMARY KEY("project_id","kind","key"),
	CONSTRAINT "project_resets_kind" CHECK ("project_resets"."kind" in ('shopping-line', 'board', 'part', 'step', 'flag', 'checklist-item'))
);
--> statement-breakpoint
-- Applied with its table, which held no rows and had no deploy writing it.
ALTER TABLE "project_resets" ADD CONSTRAINT "project_resets_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;