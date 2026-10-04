-- Reference material can now come from a web source the Referencer agent found,
-- not only from an uploaded PDF. This records which one, so the UI can show the
-- provenance after a reload and the user can tell an upload from a suggestion.
ALTER TABLE "workspace" ADD COLUMN "reference_source" JSONB;
