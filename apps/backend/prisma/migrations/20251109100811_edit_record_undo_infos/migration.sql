/*
  Warnings:

  - A unique constraint covering the columns `[undo_of_id]` on the table `edit_records` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "edit_records" ADD COLUMN     "undo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "undo_of_id" INTEGER;

-- AlterTable
ALTER TABLE "game_developers" ALTER COLUMN "extra_info" SET DEFAULT '[]'::jsonb;

-- AlterTable
ALTER TABLE "games" ALTER COLUMN "extra_info" SET DEFAULT '[]'::jsonb,
ALTER COLUMN "staffs" SET DEFAULT '[]'::jsonb;

-- CreateIndex
CREATE UNIQUE INDEX "edit_records_undo_of_id_key" ON "edit_records"("undo_of_id");

-- AddForeignKey
ALTER TABLE "edit_records" ADD CONSTRAINT "edit_records_undo_of_id_fkey" FOREIGN KEY ("undo_of_id") REFERENCES "edit_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;
