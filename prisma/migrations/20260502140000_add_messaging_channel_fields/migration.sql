-- AlterTable: add messaging channel preference and Telegram support
ALTER TABLE "Patient" ADD COLUMN "telegramChatId" TEXT;
ALTER TABLE "Patient" ADD COLUMN "preferredMessagingChannel" TEXT;

-- Add unique constraint for Telegram chat IDs
CREATE UNIQUE INDEX "Patient_telegramChatId_key" ON "Patient"("telegramChatId");
