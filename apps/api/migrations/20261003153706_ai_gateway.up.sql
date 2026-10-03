-- create "ai_catalog_providers" table
CREATE TABLE "ai_catalog_providers" ("id" character varying(100) NOT NULL, "name" character varying(200) NOT NULL, "npm" character varying(200) NULL, "api_url" character varying(500) NULL, "doc_url" character varying(500) NULL, "synced_at" timestamp(3) NOT NULL, PRIMARY KEY ("id"));
-- create "ai_catalog_models" table
CREATE TABLE "ai_catalog_models" ("id" serial NOT NULL, "model_key" character varying(200) NOT NULL, "canonical_id" character varying(200) NULL, "name" character varying(200) NOT NULL, "type" character varying(32) NULL, "family" character varying(100) NULL, "npm" character varying(200) NULL, "input_modalities" text[] NULL DEFAULT ARRAY[]::text[], "output_modalities" text[] NULL DEFAULT ARRAY[]::text[], "context_limit" integer NULL, "output_limit" integer NULL, "temperature" boolean NOT NULL DEFAULT true, "tool_call" boolean NOT NULL DEFAULT false, "reasoning" boolean NOT NULL DEFAULT false, "structured_output" boolean NULL, "input_price" double precision NULL, "output_price" double precision NULL, "cache_read_price" double precision NULL, "cache_write_price" double precision NULL, "price_tiers" jsonb NULL, "release_date" character varying(32) NULL, "synced_at" timestamp(3) NOT NULL, "provider_id" character varying(100) NOT NULL, PRIMARY KEY ("id"), CONSTRAINT "ai_catalog_models_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "ai_catalog_providers" ("id") ON UPDATE CASCADE ON DELETE CASCADE);
-- create index "ai_catalog_models_canonical_id_idx" to table: "ai_catalog_models"
CREATE INDEX "ai_catalog_models_canonical_id_idx" ON "ai_catalog_models" ("canonical_id");
-- create index "ai_catalog_models_model_key_idx" to table: "ai_catalog_models"
CREATE INDEX "ai_catalog_models_model_key_idx" ON "ai_catalog_models" ("model_key");
-- create index "ai_catalog_models_provider_id_model_key_key" to table: "ai_catalog_models"
CREATE UNIQUE INDEX "ai_catalog_models_provider_id_model_key_key" ON "ai_catalog_models" ("provider_id", "model_key");
-- create "ai_providers" table
CREATE TABLE "ai_providers" ("id" serial NOT NULL, "name" character varying(60) NOT NULL, "kind" character varying(16) NOT NULL, "base_url" character varying(500) NULL, "api_key" text NOT NULL, "key_hint" character varying(16) NOT NULL, "price_multiplier" double precision NOT NULL DEFAULT 1, "enabled" boolean NOT NULL DEFAULT true, "created" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated" timestamp(3) NOT NULL, "catalog_provider_id" character varying(100) NULL, PRIMARY KEY ("id"), CONSTRAINT "ai_providers_catalog_provider_id_fkey" FOREIGN KEY ("catalog_provider_id") REFERENCES "ai_catalog_providers" ("id") ON UPDATE CASCADE ON DELETE SET NULL);
-- create index "ai_providers_catalog_provider_id_idx" to table: "ai_providers"
CREATE INDEX "ai_providers_catalog_provider_id_idx" ON "ai_providers" ("catalog_provider_id");
-- create index "ai_providers_name_key" to table: "ai_providers"
CREATE UNIQUE INDEX "ai_providers_name_key" ON "ai_providers" ("name");
-- create "ai_provider_offers" table
CREATE TABLE "ai_provider_offers" ("id" serial NOT NULL, "upstream_id" character varying(200) NOT NULL, "name" character varying(200) NULL, "protocols" text[] NULL DEFAULT ARRAY[]::text[], "canonical_id" character varying(200) NULL, "synced_at" timestamp(3) NOT NULL, "provider_id" integer NOT NULL, PRIMARY KEY ("id"), CONSTRAINT "ai_provider_offers_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "ai_providers" ("id") ON UPDATE CASCADE ON DELETE CASCADE);
-- create index "ai_provider_offers_canonical_id_idx" to table: "ai_provider_offers"
CREATE INDEX "ai_provider_offers_canonical_id_idx" ON "ai_provider_offers" ("canonical_id");
-- create index "ai_provider_offers_provider_id_upstream_id_key" to table: "ai_provider_offers"
CREATE UNIQUE INDEX "ai_provider_offers_provider_id_upstream_id_key" ON "ai_provider_offers" ("provider_id", "upstream_id");
-- create "ai_models" table
CREATE TABLE "ai_models" ("id" serial NOT NULL, "key" character varying(200) NOT NULL, "name" character varying(100) NOT NULL, "description" character varying(500) NULL, "canonical_id" character varying(200) NULL, "vision" boolean NOT NULL DEFAULT false, "moderation" boolean NOT NULL DEFAULT false, "temperature" boolean NOT NULL DEFAULT true, "tool_call" boolean NOT NULL DEFAULT false, "reasoning" boolean NOT NULL DEFAULT false, "context_limit" integer NULL, "output_limit" integer NULL, "is_default" boolean NOT NULL DEFAULT false, "enabled" boolean NOT NULL DEFAULT true, "created" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated" timestamp(3) NOT NULL, PRIMARY KEY ("id"));
-- create index "ai_models_canonical_id_key" to table: "ai_models"
CREATE UNIQUE INDEX "ai_models_canonical_id_key" ON "ai_models" ("canonical_id");
-- create index "ai_models_key_key" to table: "ai_models"
CREATE UNIQUE INDEX "ai_models_key_key" ON "ai_models" ("key");
-- create "ai_routes" table
CREATE TABLE "ai_routes" ("id" serial NOT NULL, "upstream_id" character varying(200) NOT NULL, "protocol" character varying(16) NOT NULL, "price_manual" boolean NOT NULL DEFAULT false, "input_price" double precision NOT NULL DEFAULT 0, "output_price" double precision NOT NULL DEFAULT 0, "cache_read_price" double precision NULL, "cache_write_price" double precision NULL, "price_tiers" jsonb NULL, "dropped_params" text[] NULL DEFAULT ARRAY[]::text[], "json_mode" boolean NOT NULL DEFAULT false, "priority" integer NOT NULL DEFAULT 0, "status" character varying(16) NOT NULL DEFAULT 'active', "status_kind" character varying(16) NULL, "status_message" character varying(500) NULL, "status_at" timestamp(3) NULL, "created" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated" timestamp(3) NOT NULL, "model_id" integer NOT NULL, "provider_id" integer NOT NULL, PRIMARY KEY ("id"), CONSTRAINT "ai_routes_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "ai_models" ("id") ON UPDATE CASCADE ON DELETE CASCADE, CONSTRAINT "ai_routes_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "ai_providers" ("id") ON UPDATE CASCADE ON DELETE CASCADE);
-- create index "ai_routes_model_id_provider_id_key" to table: "ai_routes"
CREATE UNIQUE INDEX "ai_routes_model_id_provider_id_key" ON "ai_routes" ("model_id", "provider_id");
-- create index "ai_routes_provider_id_idx" to table: "ai_routes"
CREATE INDEX "ai_routes_provider_id_idx" ON "ai_routes" ("provider_id");
-- create index "ai_routes_status_idx" to table: "ai_routes"
CREATE INDEX "ai_routes_status_idx" ON "ai_routes" ("status");
-- create "ai_requests" table
CREATE TABLE "ai_requests" ("id" bigserial NOT NULL, "call_id" uuid NOT NULL, "source" character varying(16) NOT NULL, "scene" character varying(64) NULL, "upstream_id" character varying(200) NOT NULL, "protocol" character varying(16) NOT NULL, "ok" boolean NOT NULL, "error_kind" character varying(16) NULL, "error_message" character varying(500) NULL, "error_detail" text NULL, "adaptation" character varying(100) NULL, "finish_reason" character varying(32) NULL, "first_token_ms" integer NULL, "duration_ms" integer NOT NULL, "input_tokens" integer NOT NULL DEFAULT 0, "output_tokens" integer NOT NULL DEFAULT 0, "cache_read_tokens" integer NOT NULL DEFAULT 0, "cache_write_tokens" integer NOT NULL DEFAULT 0, "reasoning_tokens" integer NOT NULL DEFAULT 0, "cost_usd" double precision NOT NULL DEFAULT 0, "created" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "model_id" integer NULL, "provider_id" integer NULL, "route_id" integer NULL, PRIMARY KEY ("id"), CONSTRAINT "ai_requests_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "ai_models" ("id") ON UPDATE CASCADE ON DELETE SET NULL, CONSTRAINT "ai_requests_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "ai_providers" ("id") ON UPDATE CASCADE ON DELETE SET NULL, CONSTRAINT "ai_requests_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "ai_routes" ("id") ON UPDATE CASCADE ON DELETE SET NULL);
-- create index "ai_requests_call_id_idx" to table: "ai_requests"
CREATE INDEX "ai_requests_call_id_idx" ON "ai_requests" ("call_id");
-- create index "ai_requests_created_idx" to table: "ai_requests"
CREATE INDEX "ai_requests_created_idx" ON "ai_requests" ("created");
-- create index "ai_requests_model_id_created_idx" to table: "ai_requests"
CREATE INDEX "ai_requests_model_id_created_idx" ON "ai_requests" ("model_id", "created");
-- create index "ai_requests_provider_id_created_idx" to table: "ai_requests"
CREATE INDEX "ai_requests_provider_id_created_idx" ON "ai_requests" ("provider_id", "created");
-- create index "ai_requests_route_id_created_idx" to table: "ai_requests"
CREATE INDEX "ai_requests_route_id_created_idx" ON "ai_requests" ("route_id", "created");
-- create index "ai_requests_scene_created_idx" to table: "ai_requests"
CREATE INDEX "ai_requests_scene_created_idx" ON "ai_requests" ("scene", "created");
-- create "ai_request_payloads" table
CREATE TABLE "ai_request_payloads" ("id" bigserial NOT NULL, "input" jsonb NOT NULL, "output" text NULL, "created" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "request_id" bigint NOT NULL, PRIMARY KEY ("id"), CONSTRAINT "ai_request_payloads_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "ai_requests" ("id") ON UPDATE CASCADE ON DELETE CASCADE);
-- create index "ai_request_payloads_created_idx" to table: "ai_request_payloads"
CREATE INDEX "ai_request_payloads_created_idx" ON "ai_request_payloads" ("created");
-- create index "ai_request_payloads_request_id_key" to table: "ai_request_payloads"
CREATE UNIQUE INDEX "ai_request_payloads_request_id_key" ON "ai_request_payloads" ("request_id");
-- create "ai_route_adjustments" table
CREATE TABLE "ai_route_adjustments" ("id" serial NOT NULL, "kind" character varying(16) NOT NULL, "value" character varying(200) NOT NULL, "previous" character varying(200) NULL, "error_kind" character varying(16) NOT NULL, "created" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "request_id" bigint NULL, "route_id" integer NOT NULL, PRIMARY KEY ("id"), CONSTRAINT "ai_route_adjustments_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "ai_requests" ("id") ON UPDATE CASCADE ON DELETE SET NULL, CONSTRAINT "ai_route_adjustments_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "ai_routes" ("id") ON UPDATE CASCADE ON DELETE CASCADE);
-- create index "ai_route_adjustments_request_id_idx" to table: "ai_route_adjustments"
CREATE INDEX "ai_route_adjustments_request_id_idx" ON "ai_route_adjustments" ("request_id");
-- create index "ai_route_adjustments_route_id_kind_value_key" to table: "ai_route_adjustments"
CREATE UNIQUE INDEX "ai_route_adjustments_route_id_kind_value_key" ON "ai_route_adjustments" ("route_id", "kind", "value");
-- create "ai_scenes" table
CREATE TABLE "ai_scenes" ("id" serial NOT NULL, "key" character varying(64) NOT NULL, "temperature" double precision NULL, "max_output_tokens" integer NULL, "timeout_ms" integer NULL, "updated" timestamp(3) NOT NULL, "model_id" integer NULL, PRIMARY KEY ("id"), CONSTRAINT "ai_scenes_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "ai_models" ("id") ON UPDATE CASCADE ON DELETE SET NULL);
-- create index "ai_scenes_key_key" to table: "ai_scenes"
CREATE UNIQUE INDEX "ai_scenes_key_key" ON "ai_scenes" ("key");
-- create index "ai_scenes_model_id_idx" to table: "ai_scenes"
CREATE INDEX "ai_scenes_model_id_idx" ON "ai_scenes" ("model_id");
