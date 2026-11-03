-- Every save has written template_version from the snapshot's templateVersion, so stored rows and
-- the previous deploy's writes already match.
ALTER TABLE "projects" ADD CONSTRAINT "projects_template_version_matches_snapshot" CHECK ("projects"."template_version" = ("projects"."snapshot"->>'templateVersion')::integer);