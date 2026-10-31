-- The previous deploy deleted every tool row before inserting the new ones, so it did not rely
-- on this key.
ALTER TABLE "tools" DROP CONSTRAINT "tools_pkey";--> statement-breakpoint
ALTER TABLE "tools" ADD COLUMN "position" integer;--> statement-breakpoint
UPDATE "tools" SET "position" = "numbered"."n" FROM (SELECT "tool_type_id", row_number() OVER (ORDER BY "tool_type_id") - 1 AS "n" FROM "tools") AS "numbered" WHERE "tools"."tool_type_id" = "numbered"."tool_type_id";--> statement-breakpoint
-- Broke the previous deploy, whose tool saves did not write position and failed until this
-- deploy went live. Add a column nullable, and set NOT NULL a release after the code writes it.
ALTER TABLE "tools" ALTER COLUMN "position" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "tools" ADD PRIMARY KEY ("position");--> statement-breakpoint
ALTER TABLE "tools" ADD COLUMN "name" text DEFAULT '' NOT NULL;
