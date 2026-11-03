-- Widens the check, so the deploy still serving while this runs writes as before.
ALTER TABLE "project_progress" DROP CONSTRAINT "project_progress_kind";--> statement-breakpoint
-- Allows every kind the old check did, so stored rows and the previous deploy's writes pass.
ALTER TABLE "project_progress" ADD CONSTRAINT "project_progress_kind" CHECK ("project_progress"."kind" in ('shopping-line', 'board', 'part', 'step', 'flag', 'checklist-item'));