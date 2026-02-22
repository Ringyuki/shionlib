/*
  Warnings:

  - You are about to drop the `user_potato_vn_bindings` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "user_potato_vn_bindings" DROP CONSTRAINT "user_potato_vn_bindings_user_id_fkey";

-- AlterTable
ALTER TABLE "game_developers" ALTER COLUMN "extra_info" SET DEFAULT '[]'::jsonb;

-- AlterTable
ALTER TABLE "games" ALTER COLUMN "extra_info" SET DEFAULT '[]'::jsonb,
ALTER COLUMN "staffs" SET DEFAULT '[]'::jsonb;

-- DropTable
DROP TABLE "user_potato_vn_bindings";

-- CreateTable
CREATE TABLE "user_pvn_bindings" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "pvn_user_id" INTEGER NOT NULL,
    "pvn_user_name" VARCHAR(255) NOT NULL,
    "pvn_user_avatar" VARCHAR(255),
    "pvn_token" TEXT NOT NULL,
    "pvn_token_expires" TIMESTAMP(3) NOT NULL,
    "created" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pvn_bindings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_pvn_bindings_user_id_key" ON "user_pvn_bindings"("user_id");

-- CreateIndex
CREATE INDEX "user_pvn_bindings_pvn_user_id_idx" ON "user_pvn_bindings"("pvn_user_id");

-- AddForeignKey
ALTER TABLE "user_pvn_bindings" ADD CONSTRAINT "user_pvn_bindings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
