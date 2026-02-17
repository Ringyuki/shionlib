-- CreateEnum
CREATE TYPE "GameDownloadResourceReportReason" AS ENUM ('MALWARE', 'IRRELEVANT', 'BROKEN_LINK', 'MISLEADING_CONTENT', 'OTHER');

-- CreateEnum
CREATE TYPE "GameDownloadResourceReportStatus" AS ENUM ('PENDING', 'VALID', 'INVALID');

-- CreateEnum
CREATE TYPE "ReportMaliciousLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- AlterTable
ALTER TABLE "game_developers" ALTER COLUMN "extra_info" SET DEFAULT '[]'::jsonb;

-- AlterTable
ALTER TABLE "game_download_resources" ADD COLUMN     "status" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "games" ALTER COLUMN "extra_info" SET DEFAULT '[]'::jsonb,
ALTER COLUMN "staffs" SET DEFAULT '[]'::jsonb;

-- CreateTable
CREATE TABLE "game_download_resource_reports" (
    "id" SERIAL NOT NULL,
    "resource_id" INTEGER NOT NULL,
    "reporter_id" INTEGER NOT NULL,
    "reported_user_id" INTEGER NOT NULL,
    "reason" "GameDownloadResourceReportReason" NOT NULL,
    "detail" VARCHAR(500),
    "status" "GameDownloadResourceReportStatus" NOT NULL DEFAULT 'PENDING',
    "malicious_level" "ReportMaliciousLevel" NOT NULL,
    "processed_by" INTEGER,
    "processed_at" TIMESTAMP(3),
    "process_note" VARCHAR(500),
    "reporter_penalty_applied" BOOLEAN NOT NULL DEFAULT false,
    "reported_penalty_applied" BOOLEAN NOT NULL DEFAULT false,
    "created" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "game_download_resource_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "game_download_resource_reports_resource_id_status_idx" ON "game_download_resource_reports"("resource_id", "status");

-- CreateIndex
CREATE INDEX "game_download_resource_reports_reporter_id_status_created_idx" ON "game_download_resource_reports"("reporter_id", "status", "created");

-- CreateIndex
CREATE INDEX "game_download_resource_reports_reported_user_id_status_crea_idx" ON "game_download_resource_reports"("reported_user_id", "status", "created");

-- CreateIndex
CREATE INDEX "game_download_resource_reports_status_created_idx" ON "game_download_resource_reports"("status", "created");

-- CreateIndex
CREATE INDEX "game_download_resources_game_id_status_idx" ON "game_download_resources"("game_id", "status");

-- AddForeignKey
ALTER TABLE "game_download_resource_reports" ADD CONSTRAINT "game_download_resource_reports_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "game_download_resources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_download_resource_reports" ADD CONSTRAINT "game_download_resource_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_download_resource_reports" ADD CONSTRAINT "game_download_resource_reports_reported_user_id_fkey" FOREIGN KEY ("reported_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_download_resource_reports" ADD CONSTRAINT "game_download_resource_reports_processed_by_fkey" FOREIGN KEY ("processed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
