-- AlterTable
ALTER TABLE "game_developers" ALTER COLUMN "extra_info" SET DEFAULT '[]'::jsonb;

-- AlterTable
ALTER TABLE "games" ALTER COLUMN "extra_info" SET DEFAULT '[]'::jsonb,
ALTER COLUMN "staffs" SET DEFAULT '[]'::jsonb;

-- CreateTable
CREATE TABLE "game_download_resource_file_histories" (
    "id" SERIAL NOT NULL,
    "file_id" INTEGER NOT NULL,
    "file_size" BIGINT NOT NULL,
    "hash_algorithm" "HashAlgorithm" NOT NULL,
    "file_hash" TEXT NOT NULL,
    "s3_file_key" TEXT,
    "reason" VARCHAR(500),
    "upload_session_id" INTEGER,
    "operator_id" INTEGER NOT NULL,
    "created" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_download_resource_file_histories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "game_download_resource_file_histories_file_id_idx" ON "game_download_resource_file_histories"("file_id");

-- AddForeignKey
ALTER TABLE "game_download_resource_file_histories" ADD CONSTRAINT "game_download_resource_file_histories_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "game_download_resource_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_download_resource_file_histories" ADD CONSTRAINT "game_download_resource_file_histories_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
