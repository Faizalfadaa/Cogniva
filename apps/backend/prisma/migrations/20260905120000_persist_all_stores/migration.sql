-- AlterTable
ALTER TABLE "chat_message" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "seq" SERIAL NOT NULL;

-- AlterTable
ALTER TABLE "checkpoint" DROP COLUMN "audio_text",
DROP COLUMN "snapshot_image",
ADD COLUMN     "audio_url" TEXT,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "learner_response" TEXT,
ADD COLUMN     "seq" SERIAL NOT NULL,
ADD COLUMN     "snapshot_image_url" TEXT NOT NULL,
ADD COLUMN     "timeline" JSONB,
DROP COLUMN "whiteboard_snapshot",
ADD COLUMN     "whiteboard_snapshot" JSONB;

-- AlterTable
ALTER TABLE "confused" DROP CONSTRAINT "confused_pkey",
ADD COLUMN     "seq" INTEGER NOT NULL,
ADD CONSTRAINT "confused_pkey" PRIMARY KEY ("id_confused");

-- AlterTable
ALTER TABLE "learned" DROP CONSTRAINT "learned_pkey",
DROP COLUMN "id_learner",
ADD COLUMN     "id_learned" TEXT NOT NULL,
ADD COLUMN     "seq" INTEGER NOT NULL,
ADD CONSTRAINT "learned_pkey" PRIMARY KEY ("id_learned");

-- AlterTable
ALTER TABLE "report" ADD COLUMN     "continue_learning" TEXT[],
DROP COLUMN "created_at",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "workspace" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "id_session" TEXT NOT NULL,
ADD COLUMN     "pdf_data" BYTEA,
ADD COLUMN     "pdf_mime" TEXT,
ADD COLUMN     "reference_index" JSONB,
ADD COLUMN     "reference_text" TEXT,
ADD COLUMN     "thumbnail_url" TEXT,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "title" DROP NOT NULL,
DROP COLUMN "whiteboard_snapshot",
ADD COLUMN     "whiteboard_snapshot" JSONB;

-- CreateTable
CREATE TABLE "session" (
    "id_session" TEXT NOT NULL,
    "topic_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "started_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),
    "turn_count" INTEGER NOT NULL DEFAULT 0,
    "tokens_used" INTEGER NOT NULL DEFAULT 0,
    "evaluation_id" TEXT,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id_session")
);

-- CreateTable
CREATE TABLE "learner_state" (
    "id_session" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learner_state_pkey" PRIMARY KEY ("id_session")
);

-- CreateTable
CREATE TABLE "evaluation" (
    "id_evaluation" TEXT NOT NULL,
    "id_session" TEXT NOT NULL,
    "seq" SERIAL NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evaluation_pkey" PRIMARY KEY ("id_evaluation")
);

-- CreateTable
CREATE TABLE "board_snapshot" (
    "id_snapshot" TEXT NOT NULL,
    "id_session" TEXT NOT NULL,
    "turn_index" INTEGER NOT NULL,
    "image" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "captured_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "board_snapshot_pkey" PRIMARY KEY ("id_snapshot")
);

-- CreateTable
CREATE TABLE "speech_transcript" (
    "id_segment" TEXT NOT NULL,
    "id_session" TEXT NOT NULL,
    "payload" JSONB NOT NULL,

    CONSTRAINT "speech_transcript_pkey" PRIMARY KEY ("id_segment")
);

-- CreateTable
CREATE TABLE "learner_response" (
    "id_response" TEXT NOT NULL,
    "id_session" TEXT NOT NULL,
    "payload" JSONB NOT NULL,

    CONSTRAINT "learner_response_pkey" PRIMARY KEY ("id_response")
);

-- CreateTable
CREATE TABLE "teaching_turn" (
    "id_session" TEXT NOT NULL,
    "turn_index" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teaching_turn_pkey" PRIMARY KEY ("id_session","turn_index")
);

-- CreateIndex
CREATE UNIQUE INDEX "evaluation_seq_key" ON "evaluation"("seq");

-- CreateIndex
CREATE INDEX "evaluation_id_session_seq_idx" ON "evaluation"("id_session", "seq");

-- CreateIndex
CREATE INDEX "board_snapshot_id_session_turn_index_idx" ON "board_snapshot"("id_session", "turn_index");

-- CreateIndex
CREATE INDEX "speech_transcript_id_session_idx" ON "speech_transcript"("id_session");

-- CreateIndex
CREATE INDEX "learner_response_id_session_idx" ON "learner_response"("id_session");

-- CreateIndex
CREATE UNIQUE INDEX "chat_message_seq_key" ON "chat_message"("seq");

-- CreateIndex
CREATE INDEX "chat_message_id_workspace_seq_idx" ON "chat_message"("id_workspace", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "checkpoint_seq_key" ON "checkpoint"("seq");

-- CreateIndex
CREATE INDEX "checkpoint_id_workspace_seq_idx" ON "checkpoint"("id_workspace", "seq");

-- CreateIndex
CREATE INDEX "confused_id_report_seq_idx" ON "confused"("id_report", "seq");

-- CreateIndex
CREATE INDEX "learned_id_report_seq_idx" ON "learned"("id_report", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "report_id_workspace_key" ON "report"("id_workspace");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_id_session_key" ON "workspace"("id_session");

-- CreateIndex
CREATE INDEX "workspace_id_user_updated_at_idx" ON "workspace"("id_user", "updated_at");

-- AddForeignKey
ALTER TABLE "learner_state" ADD CONSTRAINT "learner_state_id_session_fkey" FOREIGN KEY ("id_session") REFERENCES "session"("id_session") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation" ADD CONSTRAINT "evaluation_id_session_fkey" FOREIGN KEY ("id_session") REFERENCES "session"("id_session") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "board_snapshot" ADD CONSTRAINT "board_snapshot_id_session_fkey" FOREIGN KEY ("id_session") REFERENCES "session"("id_session") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "speech_transcript" ADD CONSTRAINT "speech_transcript_id_session_fkey" FOREIGN KEY ("id_session") REFERENCES "session"("id_session") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learner_response" ADD CONSTRAINT "learner_response_id_session_fkey" FOREIGN KEY ("id_session") REFERENCES "session"("id_session") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teaching_turn" ADD CONSTRAINT "teaching_turn_id_session_fkey" FOREIGN KEY ("id_session") REFERENCES "session"("id_session") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace" ADD CONSTRAINT "workspace_id_session_fkey" FOREIGN KEY ("id_session") REFERENCES "session"("id_session") ON DELETE CASCADE ON UPDATE CASCADE;
