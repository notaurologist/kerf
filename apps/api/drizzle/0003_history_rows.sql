-- History rows are derived from saved snapshots, and nothing wrote them before #106. Clear any so the
-- new NOT NULL columns can be added; the release step writes rows for every project that has none.
DELETE FROM "project_history";--> statement-breakpoint
-- The previous deploy neither read nor wrote history rows.
ALTER TABLE "project_history" ALTER COLUMN "method_id" DROP NOT NULL;--> statement-breakpoint
-- The previous deploy did not write history rows, so it never inserts without this column.
ALTER TABLE "project_history" ADD COLUMN "operation_id" text NOT NULL;--> statement-breakpoint
-- The previous deploy did not write history rows, so it never inserts without this column.
ALTER TABLE "project_history" ADD COLUMN "inventory_key" text NOT NULL;--> statement-breakpoint
ALTER TABLE "project_history" ADD COLUMN "recorded_at" timestamp with time zone DEFAULT now() NOT NULL;