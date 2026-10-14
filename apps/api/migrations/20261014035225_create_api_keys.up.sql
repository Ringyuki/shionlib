-- modify "users" table
ALTER TABLE "users" ADD COLUMN "api_request_limit" integer NULL;
-- create "user_api_keys" table
CREATE TABLE "user_api_keys" ("id" serial NOT NULL, "name" character varying(50) NOT NULL, "prefix" character varying(16) NOT NULL, "secret_hash" character varying(64) NOT NULL, "status" integer NOT NULL DEFAULT 1, "suspended_reason" character varying(200) NULL, "suspended_at" timestamp(3) NULL, "suspended_by" integer NULL, "last_used_at" timestamp(3) NULL, "last_used_ip" text NULL, "created" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated" timestamp(3) NOT NULL, "user_id" integer NOT NULL, PRIMARY KEY ("id"), CONSTRAINT "user_api_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON UPDATE CASCADE ON DELETE CASCADE);
-- create index "user_api_keys_secret_hash_key" to table: "user_api_keys"
CREATE UNIQUE INDEX "user_api_keys_secret_hash_key" ON "user_api_keys" ("secret_hash");
-- create index "user_api_keys_user_id_idx" to table: "user_api_keys"
CREATE INDEX "user_api_keys_user_id_idx" ON "user_api_keys" ("user_id");
-- create "api_key_daily_usages" table
CREATE TABLE "api_key_daily_usages" ("id" serial NOT NULL, "day" date NOT NULL, "requests" integer NOT NULL DEFAULT 0, "throttled" integer NOT NULL DEFAULT 0, "key_id" integer NOT NULL, PRIMARY KEY ("id"), CONSTRAINT "api_key_daily_usages_key_id_fkey" FOREIGN KEY ("key_id") REFERENCES "user_api_keys" ("id") ON UPDATE CASCADE ON DELETE CASCADE);
-- create index "api_key_daily_usages_day_idx" to table: "api_key_daily_usages"
CREATE INDEX "api_key_daily_usages_day_idx" ON "api_key_daily_usages" ("day");
-- create index "api_key_daily_usages_key_id_day_key" to table: "api_key_daily_usages"
CREATE UNIQUE INDEX "api_key_daily_usages_key_id_day_key" ON "api_key_daily_usages" ("key_id", "day");
