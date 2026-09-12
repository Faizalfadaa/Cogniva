-- AlterTable
-- Nullable on purpose: reports written before this migration have no breakdown
-- to backfill, and the debrief must still render without one.
ALTER TABLE "report" ADD COLUMN     "score" INTEGER,
ADD COLUMN     "depth_score" INTEGER,
ADD COLUMN     "findings" JSONB,
ADD COLUMN     "transcript" JSONB;
