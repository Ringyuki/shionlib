/*
  Warnings:

  - You are about to drop the `game_favorite_relations` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "game_favorite_relations" DROP CONSTRAINT "game_favorite_relations_game_id_fkey";

-- DropForeignKey
ALTER TABLE "game_favorite_relations" DROP CONSTRAINT "game_favorite_relations_user_id_fkey";

-- AlterTable
ALTER TABLE "game_developers" ALTER COLUMN "extra_info" SET DEFAULT '[]'::jsonb;

-- AlterTable
ALTER TABLE "games" ALTER COLUMN "extra_info" SET DEFAULT '[]'::jsonb,
ALTER COLUMN "staffs" SET DEFAULT '[]'::jsonb;

-- DropTable
DROP TABLE "game_favorite_relations";
