-- A backfill racing a save could duplicate rows; keep the first of each.
DELETE FROM "project_history" AS "later" USING "project_history" AS "earlier" WHERE "later"."project_id" = "earlier"."project_id" AND "later"."operation_id" = "earlier"."operation_id" AND "later"."id" > "earlier"."id";--> statement-breakpoint
CREATE UNIQUE INDEX "project_history_operation" ON "project_history" USING btree ("project_id","operation_id");--> statement-breakpoint
-- The unique index serves the same lookups.
DROP INDEX "project_history_project_id";
