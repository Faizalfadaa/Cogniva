-- Keep a debrief per finished round instead of one per workspace.
--
-- The old shape had a UNIQUE on id_workspace, so finishing a resumed session
-- deleted the previous debrief before writing the new one. Every row that
-- exists now is therefore the only round its workspace has, which is round 1 --
-- so backfilling the new column with its default is exactly right and no data
-- has to be reconstructed.

ALTER TABLE "report" ADD COLUMN "round" INTEGER NOT NULL DEFAULT 1;

DROP INDEX IF EXISTS "report_id_workspace_key";

CREATE UNIQUE INDEX "report_id_workspace_round_key" ON "report" ("id_workspace", "round");

CREATE INDEX "report_id_workspace_created_at_idx" ON "report" ("id_workspace", "created_at");
