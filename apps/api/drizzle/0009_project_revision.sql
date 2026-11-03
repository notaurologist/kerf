ALTER TABLE "projects" ADD COLUMN "revision" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
-- The column was added just before with a default of 1, and the previous deploy never writes it.
ALTER TABLE "projects" ADD CONSTRAINT "projects_revision" CHECK ("projects"."revision" > 0);