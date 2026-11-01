-- Nullable, so the deploy still serving while this runs reads and writes projects as before.
ALTER TABLE "projects" ADD COLUMN "deleted_at" timestamp with time zone;