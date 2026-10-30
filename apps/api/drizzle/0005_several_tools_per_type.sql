ALTER TABLE "tools" DROP CONSTRAINT "tools_pkey";--> statement-breakpoint
ALTER TABLE "tools" ADD COLUMN "position" integer;--> statement-breakpoint
UPDATE "tools" SET "position" = "numbered"."n" FROM (SELECT "tool_type_id", row_number() OVER (ORDER BY "tool_type_id") - 1 AS "n" FROM "tools") AS "numbered" WHERE "tools"."tool_type_id" = "numbered"."tool_type_id";--> statement-breakpoint
ALTER TABLE "tools" ALTER COLUMN "position" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "tools" ADD PRIMARY KEY ("position");--> statement-breakpoint
ALTER TABLE "tools" ADD COLUMN "name" text DEFAULT '' NOT NULL;
