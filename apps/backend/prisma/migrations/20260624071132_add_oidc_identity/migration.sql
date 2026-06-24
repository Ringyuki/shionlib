-- AlterTable
ALTER TABLE "game_developers" ALTER COLUMN "extra_info" SET DEFAULT '[]'::jsonb;

-- AlterTable
ALTER TABLE "games" ALTER COLUMN "extra_info" SET DEFAULT '[]'::jsonb,
ALTER COLUMN "staffs" SET DEFAULT '[]'::jsonb;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "password" DROP NOT NULL;

-- CreateTable
CREATE TABLE "oidc_identities" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "provider" VARCHAR(32) NOT NULL,
    "subject" VARCHAR(255) NOT NULL,
    "email_at_link" VARCHAR(255),
    "last_login_at" TIMESTAMP(3),
    "created" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "oidc_identities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "oidc_identities_user_id_idx" ON "oidc_identities"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "oidc_identities_provider_subject_key" ON "oidc_identities"("provider", "subject");

-- AddForeignKey
ALTER TABLE "oidc_identities" ADD CONSTRAINT "oidc_identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
