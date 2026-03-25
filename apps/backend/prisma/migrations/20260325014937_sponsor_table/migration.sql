-- CreateEnum
CREATE TYPE "SponsorOrderStatus" AS ENUM ('NEW', 'DONE', 'EXPIRED', 'REFUND');

-- AlterTable
ALTER TABLE "game_developers" ALTER COLUMN "extra_info" SET DEFAULT '[]'::jsonb;

-- AlterTable
ALTER TABLE "games" ALTER COLUMN "extra_info" SET DEFAULT '[]'::jsonb,
ALTER COLUMN "staffs" SET DEFAULT '[]'::jsonb;

-- CreateTable
CREATE TABLE "sponsor_orders" (
    "id" SERIAL NOT NULL,
    "provider_order_id" VARCHAR(255) NOT NULL,
    "provider" VARCHAR(50) NOT NULL DEFAULT 'idatariver',
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" VARCHAR(10),
    "payment_method" VARCHAR(50),
    "status" "SponsorOrderStatus" NOT NULL DEFAULT 'NEW',
    "sponsor_name" VARCHAR(100),
    "sponsor_message" TEXT,
    "is_private" BOOLEAN NOT NULL DEFAULT false,
    "user_id" INTEGER,
    "paid_at" TIMESTAMP(3),
    "callback_verified" BOOLEAN NOT NULL DEFAULT false,
    "created" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sponsor_orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sponsor_orders_provider_order_id_key" ON "sponsor_orders"("provider_order_id");

-- CreateIndex
CREATE INDEX "sponsor_orders_status_idx" ON "sponsor_orders"("status");

-- CreateIndex
CREATE INDEX "sponsor_orders_user_id_idx" ON "sponsor_orders"("user_id");

-- CreateIndex
CREATE INDEX "sponsor_orders_created_idx" ON "sponsor_orders"("created");

-- CreateIndex
CREATE INDEX "sponsor_orders_is_private_status_created_idx" ON "sponsor_orders"("is_private", "status", "created");

-- AddForeignKey
ALTER TABLE "sponsor_orders" ADD CONSTRAINT "sponsor_orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
