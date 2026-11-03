CREATE TABLE "tools_revision" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "tools_revision_single_row" CHECK ("tools_revision"."id" = 1),
	CONSTRAINT "tools_revision_positive" CHECK ("tools_revision"."revision" > 0)
);
--> statement-breakpoint
-- A new table, so the deploy still serving ignores it. The row is added here so a database that
-- already holds tools starts at revision 1 with nothing to backfill.
INSERT INTO "tools_revision" ("id", "revision") VALUES (1, 1) ON CONFLICT DO NOTHING;
