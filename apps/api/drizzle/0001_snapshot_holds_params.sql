-- Applied with 0000 in the first production build, so no deploy ever read these columns.
ALTER TABLE "projects" DROP COLUMN "params";--> statement-breakpoint
-- Applied with 0000 in the first production build, so no deploy ever read this column.
ALTER TABLE "projects" DROP COLUMN "structural_inputs";