-- CreateEnum
CREATE TYPE "WalkthroughStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'HIDDEN', 'DELETED');

-- AlterTable
ALTER TABLE "game_developers" ALTER COLUMN "extra_info" SET DEFAULT '[]'::jsonb;

-- AlterTable
ALTER TABLE "games" ALTER COLUMN "extra_info" SET DEFAULT '[]'::jsonb,
ALTER COLUMN "staffs" SET DEFAULT '[]'::jsonb;

-- AlterTable
ALTER TABLE "moderation_events" ADD COLUMN     "walkthrough_id" INTEGER,
ALTER COLUMN "comment_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "walkthroughs" (
    "id" SERIAL NOT NULL,
    "game_id" INTEGER NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "content" JSONB NOT NULL,
    "html" VARCHAR(100000) NOT NULL,
    "created" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" TIMESTAMP(3) NOT NULL,
    "edited" BOOLEAN NOT NULL DEFAULT false,
    "status" "WalkthroughStatus" NOT NULL DEFAULT 'DRAFT',
    "creator_id" INTEGER NOT NULL,

    CONSTRAINT "walkthroughs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "walkthroughs_game_id_created_idx" ON "walkthroughs"("game_id", "created");

-- CreateIndex
CREATE INDEX "walkthroughs_creator_id_created_idx" ON "walkthroughs"("creator_id", "created");

-- AddForeignKey
ALTER TABLE "moderation_events" ADD CONSTRAINT "moderation_events_walkthrough_id_fkey" FOREIGN KEY ("walkthrough_id") REFERENCES "walkthroughs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "walkthroughs" ADD CONSTRAINT "walkthroughs_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "walkthroughs" ADD CONSTRAINT "walkthroughs_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
