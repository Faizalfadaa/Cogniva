-- Learner replies are now spoken one sentence at a time. Each row carries the
-- reply as { id, status, segments[{ text, audioUrl? }] }, rewritten as each
-- sentence's clip lands, so the UI can play and reveal it progressively.
-- learner_audio_url stays for rows recorded before this change.
ALTER TABLE "checkpoint" ADD COLUMN "speech" JSONB;
ALTER TABLE "chat_message" ADD COLUMN "speech" JSONB;
