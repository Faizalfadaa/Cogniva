-- Learner voice (§TTS).
--
-- Two URL columns plus a table for the audio itself. The bytes are stored
-- rather than kept in memory because the URL pointing at them is persisted on
-- the checkpoint and the message: without the clip, a reload would leave a play
-- button that 404s. voice_clip cascades with the workspace, so clips never
-- outlive what they belong to.

-- AlterTable
ALTER TABLE "checkpoint" ADD COLUMN     "learner_audio_url" TEXT;

-- AlterTable
ALTER TABLE "chat_message" ADD COLUMN     "learner_audio_url" TEXT;

-- CreateTable
CREATE TABLE "voice_clip" (
    "id_clip" TEXT NOT NULL,
    "id_workspace" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "mime" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "voice_clip_pkey" PRIMARY KEY ("id_clip")
);

-- CreateIndex
CREATE INDEX "voice_clip_id_workspace_idx" ON "voice_clip"("id_workspace");

-- AddForeignKey
ALTER TABLE "voice_clip" ADD CONSTRAINT "voice_clip_id_workspace_fkey" FOREIGN KEY ("id_workspace") REFERENCES "workspace"("id_workspace") ON DELETE CASCADE ON UPDATE CASCADE;
