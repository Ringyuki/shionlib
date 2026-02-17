-- AlterTable
ALTER TABLE "game_developers" ALTER COLUMN "extra_info" SET DEFAULT '[]'::jsonb;

-- AlterTable
ALTER TABLE "games" ALTER COLUMN "extra_info" SET DEFAULT '[]'::jsonb,
ALTER COLUMN "staffs" SET DEFAULT '[]'::jsonb;

-- CreateIndex
CREATE INDEX "user_banned_records_user_id_banned_at_idx" ON "user_banned_records"("user_id", "banned_at");

-- CreateIndex
CREATE INDEX "user_banned_records_user_id_unbanned_at_idx" ON "user_banned_records"("user_id", "unbanned_at");
