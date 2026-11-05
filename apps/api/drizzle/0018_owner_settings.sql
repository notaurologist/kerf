CREATE TABLE "owner_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"carry_length" double precision,
	"revision" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "owner_settings_single_row" CHECK ("owner_settings"."id" = 1),
	CONSTRAINT "owner_settings_revision_positive" CHECK ("owner_settings"."revision" > 0),
	CONSTRAINT "owner_settings_carry_length_positive" CHECK ("owner_settings"."carry_length" > 0)
);
--> statement-breakpoint
-- A new table, so the deploy still serving ignores it. The row starts with nothing entered.
INSERT INTO "owner_settings" ("id", "revision") VALUES (1, 1) ON CONFLICT DO NOTHING;
