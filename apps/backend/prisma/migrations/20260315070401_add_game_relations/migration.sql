-- CreateEnum
CREATE TYPE "GameRelationType" AS ENUM ('SEQUEL', 'PREQUEL', 'SIDE_STORY', 'MAIN_STORY', 'VARIANT', 'MAIN_VERSION', 'COLLECTION', 'COLLECTED_WORK', 'SAME_UNIVERSE', 'DIFFERENT_ADAPTATION');

-- AlterTable
ALTER TABLE "game_developers" ALTER COLUMN "extra_info" SET DEFAULT '[]'::jsonb;

-- AlterTable
ALTER TABLE "games" ALTER COLUMN "extra_info" SET DEFAULT '[]'::jsonb,
ALTER COLUMN "staffs" SET DEFAULT '[]'::jsonb;

-- CreateTable
CREATE TABLE "game_relations" (
    "id" SERIAL NOT NULL,
    "from_game_id" INTEGER NOT NULL,
    "to_game_id" INTEGER NOT NULL,
    "relation" "GameRelationType" NOT NULL,
    "created" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "game_relations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "game_relations_from_game_id_idx" ON "game_relations"("from_game_id");

-- CreateIndex
CREATE INDEX "game_relations_to_game_id_idx" ON "game_relations"("to_game_id");

-- CreateIndex
CREATE UNIQUE INDEX "game_relations_from_game_id_to_game_id_key" ON "game_relations"("from_game_id", "to_game_id");

-- AddForeignKey
ALTER TABLE "game_relations" ADD CONSTRAINT "game_relations_from_game_id_fkey" FOREIGN KEY ("from_game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_relations" ADD CONSTRAINT "game_relations_to_game_id_fkey" FOREIGN KEY ("to_game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;
