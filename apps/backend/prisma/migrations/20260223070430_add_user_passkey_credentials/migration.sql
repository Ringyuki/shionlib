-- AlterTable
ALTER TABLE "game_developers" ALTER COLUMN "extra_info" SET DEFAULT '[]'::jsonb;

-- AlterTable
ALTER TABLE "games" ALTER COLUMN "extra_info" SET DEFAULT '[]'::jsonb,
ALTER COLUMN "staffs" SET DEFAULT '[]'::jsonb;

-- CreateTable
CREATE TABLE "user_passkey_credentials" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "credential_id" VARCHAR(512) NOT NULL,
    "public_key" TEXT NOT NULL,
    "counter" INTEGER NOT NULL DEFAULT 0,
    "transports" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "aaguid" VARCHAR(64),
    "device_type" VARCHAR(32),
    "credential_backed_up" BOOLEAN NOT NULL DEFAULT false,
    "name" VARCHAR(128),
    "last_used_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_passkey_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_passkey_credentials_credential_id_key" ON "user_passkey_credentials"("credential_id");

-- CreateIndex
CREATE INDEX "user_passkey_credentials_user_id_revoked_at_idx" ON "user_passkey_credentials"("user_id", "revoked_at");

-- CreateIndex
CREATE INDEX "user_passkey_credentials_last_used_at_idx" ON "user_passkey_credentials"("last_used_at");

-- AddForeignKey
ALTER TABLE "user_passkey_credentials" ADD CONSTRAINT "user_passkey_credentials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
