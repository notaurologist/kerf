CREATE TABLE "login_failures" (
	"scope" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"failures" integer NOT NULL,
	CONSTRAINT "login_failures_scope_window_start_pk" PRIMARY KEY("scope","window_start"),
	CONSTRAINT "login_failures_failures" CHECK ("login_failures"."failures" > 0)
);
--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "password_fingerprint" text;