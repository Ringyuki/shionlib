-- AlterTable
ALTER TABLE "game_developers" ALTER COLUMN "extra_info" SET DEFAULT '[]'::jsonb;

-- AlterTable
ALTER TABLE "games" ALTER COLUMN "extra_info" SET DEFAULT '[]'::jsonb,
ALTER COLUMN "staffs" SET DEFAULT '[]'::jsonb;

-- CreateTable
CREATE TABLE "user_game_pvn_mappings" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "game_id" INTEGER NOT NULL,
    "pvn_galgame_id" INTEGER NOT NULL,
    "total_play_time" INTEGER NOT NULL DEFAULT 0,
    "last_play_date" TIMESTAMP(3),
    "play_type" INTEGER NOT NULL DEFAULT 0,
    "my_rate" INTEGER NOT NULL DEFAULT 0,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_game_pvn_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_game_pvn_mappings_user_id_idx" ON "user_game_pvn_mappings"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_game_pvn_mappings_user_id_game_id_key" ON "user_game_pvn_mappings"("user_id", "game_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_game_pvn_mappings_user_id_pvn_galgame_id_key" ON "user_game_pvn_mappings"("user_id", "pvn_galgame_id");

-- AddForeignKey
ALTER TABLE "user_game_pvn_mappings" ADD CONSTRAINT "user_game_pvn_mappings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_game_pvn_mappings" ADD CONSTRAINT "user_game_pvn_mappings_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;
