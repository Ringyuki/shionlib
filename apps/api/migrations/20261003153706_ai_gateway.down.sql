-- reverse: create index "ai_scenes_model_id_idx" to table: "ai_scenes"
DROP INDEX "ai_scenes_model_id_idx";
-- reverse: create index "ai_scenes_key_key" to table: "ai_scenes"
DROP INDEX "ai_scenes_key_key";
-- reverse: create "ai_scenes" table
DROP TABLE "ai_scenes";
-- reverse: create index "ai_route_adjustments_route_id_kind_value_key" to table: "ai_route_adjustments"
DROP INDEX "ai_route_adjustments_route_id_kind_value_key";
-- reverse: create index "ai_route_adjustments_request_id_idx" to table: "ai_route_adjustments"
DROP INDEX "ai_route_adjustments_request_id_idx";
-- reverse: create "ai_route_adjustments" table
DROP TABLE "ai_route_adjustments";
-- reverse: create index "ai_request_payloads_request_id_key" to table: "ai_request_payloads"
DROP INDEX "ai_request_payloads_request_id_key";
-- reverse: create index "ai_request_payloads_created_idx" to table: "ai_request_payloads"
DROP INDEX "ai_request_payloads_created_idx";
-- reverse: create "ai_request_payloads" table
DROP TABLE "ai_request_payloads";
-- reverse: create index "ai_requests_scene_created_idx" to table: "ai_requests"
DROP INDEX "ai_requests_scene_created_idx";
-- reverse: create index "ai_requests_route_id_created_idx" to table: "ai_requests"
DROP INDEX "ai_requests_route_id_created_idx";
-- reverse: create index "ai_requests_provider_id_created_idx" to table: "ai_requests"
DROP INDEX "ai_requests_provider_id_created_idx";
-- reverse: create index "ai_requests_model_id_created_idx" to table: "ai_requests"
DROP INDEX "ai_requests_model_id_created_idx";
-- reverse: create index "ai_requests_created_idx" to table: "ai_requests"
DROP INDEX "ai_requests_created_idx";
-- reverse: create index "ai_requests_call_id_idx" to table: "ai_requests"
DROP INDEX "ai_requests_call_id_idx";
-- reverse: create "ai_requests" table
DROP TABLE "ai_requests";
-- reverse: create index "ai_routes_status_idx" to table: "ai_routes"
DROP INDEX "ai_routes_status_idx";
-- reverse: create index "ai_routes_provider_id_idx" to table: "ai_routes"
DROP INDEX "ai_routes_provider_id_idx";
-- reverse: create index "ai_routes_model_id_provider_id_key" to table: "ai_routes"
DROP INDEX "ai_routes_model_id_provider_id_key";
-- reverse: create "ai_routes" table
DROP TABLE "ai_routes";
-- reverse: create index "ai_models_key_key" to table: "ai_models"
DROP INDEX "ai_models_key_key";
-- reverse: create index "ai_models_canonical_id_key" to table: "ai_models"
DROP INDEX "ai_models_canonical_id_key";
-- reverse: create "ai_models" table
DROP TABLE "ai_models";
-- reverse: create index "ai_provider_offers_provider_id_upstream_id_key" to table: "ai_provider_offers"
DROP INDEX "ai_provider_offers_provider_id_upstream_id_key";
-- reverse: create index "ai_provider_offers_canonical_id_idx" to table: "ai_provider_offers"
DROP INDEX "ai_provider_offers_canonical_id_idx";
-- reverse: create "ai_provider_offers" table
DROP TABLE "ai_provider_offers";
-- reverse: create index "ai_providers_name_key" to table: "ai_providers"
DROP INDEX "ai_providers_name_key";
-- reverse: create index "ai_providers_catalog_provider_id_idx" to table: "ai_providers"
DROP INDEX "ai_providers_catalog_provider_id_idx";
-- reverse: create "ai_providers" table
DROP TABLE "ai_providers";
-- reverse: create index "ai_catalog_models_provider_id_model_key_key" to table: "ai_catalog_models"
DROP INDEX "ai_catalog_models_provider_id_model_key_key";
-- reverse: create index "ai_catalog_models_model_key_idx" to table: "ai_catalog_models"
DROP INDEX "ai_catalog_models_model_key_idx";
-- reverse: create index "ai_catalog_models_canonical_id_idx" to table: "ai_catalog_models"
DROP INDEX "ai_catalog_models_canonical_id_idx";
-- reverse: create "ai_catalog_models" table
DROP TABLE "ai_catalog_models";
-- reverse: create "ai_catalog_providers" table
DROP TABLE "ai_catalog_providers";
