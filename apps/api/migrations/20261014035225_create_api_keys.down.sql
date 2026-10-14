-- reverse: create index "api_key_daily_usages_key_id_day_key" to table: "api_key_daily_usages"
DROP INDEX "api_key_daily_usages_key_id_day_key";
-- reverse: create index "api_key_daily_usages_day_idx" to table: "api_key_daily_usages"
DROP INDEX "api_key_daily_usages_day_idx";
-- reverse: create "api_key_daily_usages" table
DROP TABLE "api_key_daily_usages";
-- reverse: create index "user_api_keys_user_id_idx" to table: "user_api_keys"
DROP INDEX "user_api_keys_user_id_idx";
-- reverse: create index "user_api_keys_secret_hash_key" to table: "user_api_keys"
DROP INDEX "user_api_keys_secret_hash_key";
-- reverse: create "user_api_keys" table
DROP TABLE "user_api_keys";
-- reverse: modify "users" table
ALTER TABLE "users" DROP COLUMN "api_request_limit";
