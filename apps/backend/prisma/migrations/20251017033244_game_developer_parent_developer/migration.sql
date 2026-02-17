-- AlterTable
ALTER TABLE "game_developers" ADD COLUMN     "parent_developer_id" INTEGER,
ALTER COLUMN "extra_info" SET DEFAULT '[]'::jsonb;

-- AlterTable
ALTER TABLE "games" ALTER COLUMN "extra_info" SET DEFAULT '[]'::jsonb,
ALTER COLUMN "staffs" SET DEFAULT '[]'::jsonb;

-- AddForeignKey
ALTER TABLE "game_developers" ADD CONSTRAINT "game_developers_parent_developer_id_fkey" FOREIGN KEY ("parent_developer_id") REFERENCES "game_developers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
