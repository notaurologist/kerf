ALTER TABLE "projects" ADD COLUMN "revision" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_revision" CHECK ("projects"."revision" > 0);