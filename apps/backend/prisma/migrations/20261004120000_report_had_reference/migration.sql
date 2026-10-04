-- Whether the session had reference material when it was evaluated.
--
-- Without one the Evaluator has nothing to check the teaching against, so the
-- debrief says so beside the score. Recorded per round at evaluation time, not
-- read from the workspace later, because a reference added afterwards does not
-- change how an earlier round was graded.
--
-- Nullable with no backfill: an earlier report's answer is unknown, and the
-- screen shows nothing for it rather than guessing.
ALTER TABLE "report" ADD COLUMN "had_reference" BOOLEAN;
