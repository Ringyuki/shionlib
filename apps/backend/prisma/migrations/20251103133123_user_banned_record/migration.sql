-- AlterTable
ALTER TABLE "game_developers" ALTER COLUMN "extra_info" SET DEFAULT '[]'::jsonb;

-- AlterTable
ALTER TABLE "games" ALTER COLUMN "extra_info" SET DEFAULT '[]'::jsonb,
ALTER COLUMN "staffs" SET DEFAULT '[]'::jsonb;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "upload_injected_file_times" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "user_banned_records" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "banned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "banned_reason" VARCHAR(255),
    "banned_by" INTEGER,
    "banned_duration_days" INTEGER,
    "is_permanent" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "user_banned_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- AddForeignKey
ALTER TABLE "user_banned_records" ADD CONSTRAINT "user_banned_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_banned_records" ADD CONSTRAINT "user_banned_records_banned_by_fkey" FOREIGN KEY ("banned_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
