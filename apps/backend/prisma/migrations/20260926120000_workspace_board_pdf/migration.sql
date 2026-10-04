-- The PDF a board is drawn on: its pages replace the blank whiteboard, and the
-- user writes on top of them.
--
-- A second pair of columns rather than a reuse of pdf_data/pdf_mime, because the
-- two PDFs have opposite audiences. pdf_data is the reference: the Evaluator's
-- answer key, which by invariant never reaches the Learner. These pages are
-- teaching material -- the page being explained is captured into the checkpoint
-- image and read by Vision like any other board. A user may point the board at
-- the same file they uploaded as reference; that is their choice to make, and it
-- is made per workspace rather than baked into one column serving both roles.
--
-- Nullable with no backfill: every existing workspace is a blank whiteboard,
-- which is exactly what a null here means.
ALTER TABLE "workspace" ADD COLUMN "board_pdf_data" BYTEA;
ALTER TABLE "workspace" ADD COLUMN "board_pdf_mime" TEXT;
