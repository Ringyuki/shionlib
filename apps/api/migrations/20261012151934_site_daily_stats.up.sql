-- create "site_daily_stats" table
CREATE TABLE "site_daily_stats" ("id" serial NOT NULL, "day" date NOT NULL, "views" integer NOT NULL DEFAULT 0, "downloads" integer NOT NULL DEFAULT 0, PRIMARY KEY ("id"));
-- create index "site_daily_stats_day_key" to table: "site_daily_stats"
CREATE UNIQUE INDEX "site_daily_stats_day_key" ON "site_daily_stats" ("day");
