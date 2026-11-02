-- "Other tools" were removed in #363. Production has run that code since it deployed, so the
-- deploy still serving while this runs no longer reads or writes this table.
DROP TABLE "other_tools" CASCADE;
