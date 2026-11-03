-- The deploy still serving writes both from the same template, and the release refuses a
-- database with a row that breaks this before migrating (scripts/release.ts).
ALTER TABLE "projects" ADD CONSTRAINT "projects_template_id_matches_snapshot" CHECK ("projects"."template_id" = "projects"."snapshot"->>'templateId');