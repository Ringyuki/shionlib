-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('COMMENT_REPLY', 'COMMENT_LIKE', 'SYSTEM');

-- AlterEnum
ALTER TYPE "ActivityType" ADD VALUE 'GAME_CREATE';

-- AlterTable
ALTER TABLE "game_developers" ALTER COLUMN "extra_info" SET DEFAULT '[]'::jsonb;

-- AlterTable
ALTER TABLE "games" ALTER COLUMN "extra_info" SET DEFAULT '[]'::jsonb,
ALTER COLUMN "staffs" SET DEFAULT '[]'::jsonb;

-- CreateTable
CREATE TABLE "messages" (
    "id" SERIAL NOT NULL,
    "type" "MessageType" NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "content" VARCHAR(10240) NOT NULL,
    "link_text" VARCHAR(255),
    "link_url" VARCHAR(255),
    "external_link" BOOLEAN NOT NULL DEFAULT false,
    "comment_id" INTEGER,
    "game_id" INTEGER,
    "sender_id" INTEGER,
    "receiver_id" INTEGER NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "created" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
