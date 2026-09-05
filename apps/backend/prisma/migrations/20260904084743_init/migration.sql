-- CreateTable
CREATE TABLE "users" (
    "id_user" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "profile_photo" TEXT NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id_user")
);

-- CreateTable
CREATE TABLE "workspace" (
    "id_workspace" TEXT NOT NULL,
    "id_user" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "whiteboard_snapshot" TEXT NOT NULL,

    CONSTRAINT "workspace_pkey" PRIMARY KEY ("id_workspace")
);

-- CreateTable
CREATE TABLE "checkpoint" (
    "id_checkpoint" TEXT NOT NULL,
    "id_workspace" TEXT NOT NULL,
    "snapshot_image" TEXT NOT NULL,
    "whiteboard_snapshot" TEXT NOT NULL,
    "audio_text" TEXT NOT NULL,

    CONSTRAINT "checkpoint_pkey" PRIMARY KEY ("id_checkpoint")
);

-- CreateTable
CREATE TABLE "chat_message" (
    "id_chat" TEXT NOT NULL,
    "id_workspace" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "content" TEXT NOT NULL,

    CONSTRAINT "chat_message_pkey" PRIMARY KEY ("id_chat")
);

-- CreateTable
CREATE TABLE "report" (
    "id_report" TEXT NOT NULL,
    "id_workspace" TEXT NOT NULL,
    "letter" TEXT NOT NULL,
    "reflection" TEXT NOT NULL,
    "created_at" TEXT NOT NULL,

    CONSTRAINT "report_pkey" PRIMARY KEY ("id_report")
);

-- CreateTable
CREATE TABLE "learned" (
    "id_learner" TEXT NOT NULL,
    "id_report" TEXT NOT NULL,
    "content" TEXT NOT NULL,

    CONSTRAINT "learned_pkey" PRIMARY KEY ("id_learner","id_report")
);

-- CreateTable
CREATE TABLE "confused" (
    "id_confused" TEXT NOT NULL,
    "id_report" TEXT NOT NULL,
    "content" TEXT NOT NULL,

    CONSTRAINT "confused_pkey" PRIMARY KEY ("id_confused","id_report")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- AddForeignKey
ALTER TABLE "workspace" ADD CONSTRAINT "workspace_id_user_fkey" FOREIGN KEY ("id_user") REFERENCES "users"("id_user") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkpoint" ADD CONSTRAINT "checkpoint_id_workspace_fkey" FOREIGN KEY ("id_workspace") REFERENCES "workspace"("id_workspace") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_id_workspace_fkey" FOREIGN KEY ("id_workspace") REFERENCES "workspace"("id_workspace") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report" ADD CONSTRAINT "report_id_workspace_fkey" FOREIGN KEY ("id_workspace") REFERENCES "workspace"("id_workspace") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learned" ADD CONSTRAINT "learned_id_report_fkey" FOREIGN KEY ("id_report") REFERENCES "report"("id_report") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "confused" ADD CONSTRAINT "confused_id_report_fkey" FOREIGN KEY ("id_report") REFERENCES "report"("id_report") ON DELETE CASCADE ON UPDATE CASCADE;
