-- Which student the user picked. It lived only in the browser's localStorage,
-- so the backend could not see it and synthesized the voice from the workspace
-- id instead -- giving Yuzuki on screen Akira's voice whenever the user picked
-- someone other than the id-derived default.
ALTER TABLE "workspace" ADD COLUMN "learner_id" TEXT;
