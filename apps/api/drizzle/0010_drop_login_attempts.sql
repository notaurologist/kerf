-- The login counter moved to login_failures in migration 0008. Production has run that code
-- since it deployed, so the deploy still serving while this runs no longer reads or writes it.
DROP TABLE "login_attempts" CASCADE;
