-- Ends any statement from the app's role that runs past 15 seconds, so a runaway query or a lock
-- wait cannot hold a connection until the function is stopped. Set on the role because Neon's
-- pooler refuses statement_timeout as a startup parameter. Applies to sessions opened afterwards.
ALTER ROLE CURRENT_USER SET statement_timeout = '15s';
