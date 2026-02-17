-- CreateEnum
CREATE TYPE "UserLang" AS ENUM ('en', 'zh', 'ja');

-- CreateEnum
CREATE TYPE "GameCharacterBloodType" AS ENUM ('a', 'b', 'ab', 'o');

-- CreateEnum
CREATE TYPE "GameCharacterGender" AS ENUM ('m', 'f', 'o', 'a');

-- CreateEnum
CREATE TYPE "GameCharacterRole" AS ENUM ('main', 'primary', 'side', 'appears');

-- CreateEnum
CREATE TYPE "GameUploadSessionStatus" AS ENUM ('INITIATED', 'UPLOADING', 'COMPLETED', 'ABORTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "UserUploadQuotaRecordAction" AS ENUM ('ADD', 'SUB', 'USE');

-- CreateEnum
CREATE TYPE "UserUploadQuotaRecordField" AS ENUM ('SIZE', 'USED');

-- CreateEnum
CREATE TYPE "UserUploadQuotaRecordStatus" AS ENUM ('COMPLETED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "PermissionEntity" AS ENUM ('game', 'character', 'developer');

-- CreateEnum
CREATE TYPE "EditActionType" AS ENUM ('UPDATE_SCALAR', 'ADD_RELATION', 'REMOVE_RELATION', 'SET_RELATION', 'UPDATE_RELATION');

-- CreateEnum
CREATE TYPE "EditRelationType" AS ENUM ('cover', 'image', 'link', 'developer', 'character');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(20) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "avatar" TEXT,
    "cover" TEXT,
    "lang" "UserLang" NOT NULL DEFAULT 'en',
    "role" INTEGER NOT NULL DEFAULT 1,
    "status" INTEGER NOT NULL DEFAULT 1,
    "email_verified_at" TIMESTAMP(3),
    "last_login_at" TIMESTAMP(3),
    "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false,
    "created" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_login_sessions" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "refresh_token_hash" VARCHAR(255) NOT NULL,
    "refresh_token_prefix" VARCHAR(32) NOT NULL,
    "status" INTEGER NOT NULL DEFAULT 1,
    "family_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "replaced_by_id" INTEGER,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "last_used_at" TIMESTAMP(3),
    "rotated_at" TIMESTAMP(3),
    "reused_at" TIMESTAMP(3),
    "blocked_at" TIMESTAMP(3),
    "blocked_reason" VARCHAR(255),
    "ip" TEXT,
    "user_agent" TEXT,
    "device_info" TEXT,
    "created" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_login_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "games" (
    "id" SERIAL NOT NULL,
    "v_id" TEXT,
    "b_id" TEXT,
    "title_jp" VARCHAR(255) NOT NULL DEFAULT '',
    "title_zh" VARCHAR(255) NOT NULL DEFAULT '',
    "title_en" VARCHAR(255) NOT NULL DEFAULT '',
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "intro_jp" VARCHAR(2000) NOT NULL DEFAULT '',
    "intro_zh" VARCHAR(2000) NOT NULL DEFAULT '',
    "intro_en" VARCHAR(2000) NOT NULL DEFAULT '',
    "release_date" TIMESTAMP(3),
    "extra_info" JSONB DEFAULT '[]'::jsonb,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "staffs" JSONB DEFAULT '[]'::jsonb,
    "nsfw" BOOLEAN NOT NULL DEFAULT false,
    "type" TEXT,
    "platform" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "views" INTEGER NOT NULL DEFAULT 0,
    "creator_id" INTEGER NOT NULL,
    "status" INTEGER NOT NULL DEFAULT 1,
    "created" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "games_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_links" (
    "id" SERIAL NOT NULL,
    "url" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" TIMESTAMP(3) NOT NULL,
    "game_id" INTEGER NOT NULL,

    CONSTRAINT "game_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_covers" (
    "id" SERIAL NOT NULL,
    "language" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "dims" INTEGER[],
    "sexual" INTEGER NOT NULL,
    "violence" INTEGER NOT NULL,
    "created" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" TIMESTAMP(3) NOT NULL,
    "game_id" INTEGER NOT NULL,

    CONSTRAINT "game_covers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_images" (
    "id" SERIAL NOT NULL,
    "url" TEXT NOT NULL,
    "dims" INTEGER[],
    "sexual" INTEGER NOT NULL,
    "violence" INTEGER NOT NULL,
    "created" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" TIMESTAMP(3) NOT NULL,
    "game_id" INTEGER NOT NULL,

    CONSTRAINT "game_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_developers" (
    "id" SERIAL NOT NULL,
    "b_id" TEXT,
    "v_id" TEXT,
    "name" VARCHAR(255) NOT NULL DEFAULT '',
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "logo" TEXT,
    "intro_jp" VARCHAR(2000) NOT NULL DEFAULT '',
    "intro_zh" VARCHAR(2000) NOT NULL DEFAULT '',
    "intro_en" VARCHAR(2000) NOT NULL DEFAULT '',
    "extra_info" JSONB DEFAULT '[]'::jsonb,
    "created" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "game_developers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_developer_relations" (
    "id" SERIAL NOT NULL,
    "role" TEXT,
    "game_id" INTEGER NOT NULL,
    "developer_id" INTEGER NOT NULL,
    "created" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "game_developer_relations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_characters" (
    "id" SERIAL NOT NULL,
    "b_id" TEXT,
    "v_id" TEXT,
    "image" TEXT,
    "name_jp" TEXT NOT NULL DEFAULT '',
    "name_zh" TEXT,
    "name_en" TEXT,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "intro_jp" VARCHAR(2000) NOT NULL DEFAULT '',
    "intro_zh" VARCHAR(2000) NOT NULL DEFAULT '',
    "intro_en" VARCHAR(2000) NOT NULL DEFAULT '',
    "blood_type" "GameCharacterBloodType",
    "height" INTEGER,
    "weight" INTEGER,
    "bust" INTEGER,
    "waist" INTEGER,
    "hips" INTEGER,
    "cup" TEXT,
    "age" INTEGER,
    "birthday" INTEGER[],
    "gender" "GameCharacterGender"[] DEFAULT ARRAY[]::"GameCharacterGender"[],
    "created" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "game_characters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_character_relations" (
    "id" SERIAL NOT NULL,
    "image" TEXT,
    "actor" TEXT,
    "role" "GameCharacterRole",
    "game_id" INTEGER NOT NULL,
    "character_id" INTEGER NOT NULL,
    "created" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "game_character_relations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_download_resources" (
    "id" SERIAL NOT NULL,
    "game_id" INTEGER NOT NULL,
    "platform" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "language" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "note" VARCHAR(255),
    "downloads" INTEGER NOT NULL DEFAULT 0,
    "upload_session_id" INTEGER,
    "creator_id" INTEGER NOT NULL,
    "created" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "game_download_resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_download_resource_files" (
    "id" SERIAL NOT NULL,
    "type" INTEGER NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_path" TEXT,
    "file_size" BIGINT NOT NULL,
    "file_url" TEXT,
    "s3_file_key" TEXT,
    "file_content_type" TEXT,
    "file_hash" TEXT NOT NULL,
    "upload_session_id" INTEGER,
    "file_status" INTEGER NOT NULL DEFAULT 1,
    "file_check_status" INTEGER NOT NULL DEFAULT 0,
    "game_download_resource_id" INTEGER NOT NULL,
    "creator_id" INTEGER NOT NULL,
    "created" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "game_download_resource_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_favorite_relations" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "game_id" INTEGER NOT NULL,

    CONSTRAINT "game_favorite_relations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" SERIAL NOT NULL,
    "content" JSONB NOT NULL,
    "html" VARCHAR(100000),
    "game_id" INTEGER NOT NULL,
    "parent_id" INTEGER,
    "root_id" INTEGER,
    "reply_count" INTEGER NOT NULL DEFAULT 0,
    "creator_id" INTEGER NOT NULL,
    "test" TEXT,
    "status" INTEGER NOT NULL DEFAULT 1,
    "edited" BOOLEAN NOT NULL DEFAULT false,
    "created" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_upload_sessions" (
    "id" SERIAL NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT,
    "total_size" BIGINT NOT NULL,
    "chunk_size" INTEGER NOT NULL,
    "total_chunks" INTEGER NOT NULL,
    "uploaded_chunks" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "file_sha256" TEXT NOT NULL,
    "status" "GameUploadSessionStatus" NOT NULL,
    "storage_path" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "creator_id" INTEGER NOT NULL,
    "created" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "game_upload_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_upload_chunks" (
    "id" SERIAL NOT NULL,
    "game_upload_session_id" INTEGER NOT NULL,
    "index" INTEGER NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "created" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "game_upload_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_upload_quotas" (
    "id" SERIAL NOT NULL,
    "size" BIGINT NOT NULL,
    "used" BIGINT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "created" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_upload_quotas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_upload_quota_records" (
    "id" SERIAL NOT NULL,
    "field" "UserUploadQuotaRecordField" NOT NULL,
    "amount" BIGINT NOT NULL,
    "action" "UserUploadQuotaRecordAction" NOT NULL,
    "action_reason" VARCHAR(255),
    "status" "UserUploadQuotaRecordStatus" NOT NULL DEFAULT 'COMPLETED',
    "upload_session_id" INTEGER,
    "user_upload_quota_id" INTEGER NOT NULL,
    "created" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_upload_quota_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_permission_mappings" (
    "id" SERIAL NOT NULL,
    "entity" "PermissionEntity" NOT NULL,
    "field" TEXT NOT NULL,
    "bitIndex" INTEGER NOT NULL,
    "isRelation" BOOLEAN NOT NULL DEFAULT false,
    "created" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "field_permission_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_field_permissions" (
    "id" SERIAL NOT NULL,
    "role" INTEGER NOT NULL,
    "entity" "PermissionEntity" NOT NULL,
    "allowMask" BIGINT NOT NULL DEFAULT 0,
    "created" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "role_field_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_field_permissions" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "entity" "PermissionEntity" NOT NULL,
    "allowMask" BIGINT NOT NULL DEFAULT 0,
    "created" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_field_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "edit_records" (
    "id" SERIAL NOT NULL,
    "entity" "PermissionEntity" NOT NULL,
    "target_id" INTEGER NOT NULL,
    "action" "EditActionType" NOT NULL,
    "actor_id" INTEGER NOT NULL,
    "actor_role" INTEGER NOT NULL,
    "field_mask" BIGINT NOT NULL DEFAULT 0,
    "field_changes" TEXT[],
    "changes" JSONB,
    "relation_type" "EditRelationType",
    "note" VARCHAR(255),
    "created" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "edit_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_user_like_comment" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_user_like_comment_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_name_key" ON "users"("name");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_name_idx" ON "users"("name");

-- CreateIndex
CREATE INDEX "users_created_idx" ON "users"("created");

-- CreateIndex
CREATE INDEX "user_login_sessions_family_id_idx" ON "user_login_sessions"("family_id");

-- CreateIndex
CREATE INDEX "user_login_sessions_user_id_status_idx" ON "user_login_sessions"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "user_login_sessions_refresh_token_prefix_key" ON "user_login_sessions"("refresh_token_prefix");

-- CreateIndex
CREATE INDEX "games_b_id_v_id_idx" ON "games"("b_id", "v_id");

-- CreateIndex
CREATE INDEX "games_b_id_idx" ON "games"("b_id");

-- CreateIndex
CREATE INDEX "games_v_id_idx" ON "games"("v_id");

-- CreateIndex
CREATE UNIQUE INDEX "games_b_id_v_id_key" ON "games"("b_id", "v_id");

-- CreateIndex
CREATE INDEX "game_developers_b_id_v_id_idx" ON "game_developers"("b_id", "v_id");

-- CreateIndex
CREATE INDEX "game_developers_b_id_idx" ON "game_developers"("b_id");

-- CreateIndex
CREATE INDEX "game_developers_v_id_idx" ON "game_developers"("v_id");

-- CreateIndex
CREATE UNIQUE INDEX "game_developers_b_id_v_id_key" ON "game_developers"("b_id", "v_id");

-- CreateIndex
CREATE UNIQUE INDEX "game_developer_relations_game_id_developer_id_key" ON "game_developer_relations"("game_id", "developer_id");

-- CreateIndex
CREATE INDEX "game_characters_b_id_v_id_idx" ON "game_characters"("b_id", "v_id");

-- CreateIndex
CREATE INDEX "game_characters_b_id_idx" ON "game_characters"("b_id");

-- CreateIndex
CREATE INDEX "game_characters_v_id_idx" ON "game_characters"("v_id");

-- CreateIndex
CREATE UNIQUE INDEX "game_characters_b_id_v_id_key" ON "game_characters"("b_id", "v_id");

-- CreateIndex
CREATE UNIQUE INDEX "game_character_relations_game_id_character_id_key" ON "game_character_relations"("game_id", "character_id");

-- CreateIndex
CREATE INDEX "game_download_resource_files_file_path_idx" ON "game_download_resource_files"("file_path");

-- CreateIndex
CREATE UNIQUE INDEX "game_download_resource_files_upload_session_id_key" ON "game_download_resource_files"("upload_session_id");

-- CreateIndex
CREATE UNIQUE INDEX "game_download_resource_files_file_path_key" ON "game_download_resource_files"("file_path");

-- CreateIndex
CREATE UNIQUE INDEX "game_favorite_relations_user_id_game_id_key" ON "game_favorite_relations"("user_id", "game_id");

-- CreateIndex
CREATE INDEX "comments_game_id_created_idx" ON "comments"("game_id", "created");

-- CreateIndex
CREATE INDEX "comments_parent_id_created_idx" ON "comments"("parent_id", "created");

-- CreateIndex
CREATE INDEX "comments_creator_id_created_idx" ON "comments"("creator_id", "created");

-- CreateIndex
CREATE INDEX "game_upload_sessions_expires_at_idx" ON "game_upload_sessions"("expires_at");

-- CreateIndex
CREATE INDEX "game_upload_sessions_status_idx" ON "game_upload_sessions"("status");

-- CreateIndex
CREATE INDEX "game_upload_chunks_game_upload_session_id_index_idx" ON "game_upload_chunks"("game_upload_session_id", "index");

-- CreateIndex
CREATE INDEX "game_upload_chunks_game_upload_session_id_idx" ON "game_upload_chunks"("game_upload_session_id");

-- CreateIndex
CREATE UNIQUE INDEX "game_upload_chunks_game_upload_session_id_index_key" ON "game_upload_chunks"("game_upload_session_id", "index");

-- CreateIndex
CREATE UNIQUE INDEX "user_upload_quotas_user_id_key" ON "user_upload_quotas"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_upload_quota_records_upload_session_id_key" ON "user_upload_quota_records"("upload_session_id");

-- CreateIndex
CREATE INDEX "field_permission_mappings_entity_idx" ON "field_permission_mappings"("entity");

-- CreateIndex
CREATE UNIQUE INDEX "field_permission_mappings_entity_field_key" ON "field_permission_mappings"("entity", "field");

-- CreateIndex
CREATE UNIQUE INDEX "field_permission_mappings_entity_bitIndex_key" ON "field_permission_mappings"("entity", "bitIndex");

-- CreateIndex
CREATE INDEX "role_field_permissions_role_entity_idx" ON "role_field_permissions"("role", "entity");

-- CreateIndex
CREATE UNIQUE INDEX "role_field_permissions_role_entity_key" ON "role_field_permissions"("role", "entity");

-- CreateIndex
CREATE INDEX "user_field_permissions_user_id_entity_idx" ON "user_field_permissions"("user_id", "entity");

-- CreateIndex
CREATE UNIQUE INDEX "user_field_permissions_user_id_entity_key" ON "user_field_permissions"("user_id", "entity");

-- CreateIndex
CREATE INDEX "_user_like_comment_B_index" ON "_user_like_comment"("B");

-- AddForeignKey
ALTER TABLE "user_login_sessions" ADD CONSTRAINT "user_login_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_login_sessions" ADD CONSTRAINT "user_login_sessions_replaced_by_id_fkey" FOREIGN KEY ("replaced_by_id") REFERENCES "user_login_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "games" ADD CONSTRAINT "games_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_links" ADD CONSTRAINT "game_links_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_covers" ADD CONSTRAINT "game_covers_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_images" ADD CONSTRAINT "game_images_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_developer_relations" ADD CONSTRAINT "game_developer_relations_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_developer_relations" ADD CONSTRAINT "game_developer_relations_developer_id_fkey" FOREIGN KEY ("developer_id") REFERENCES "game_developers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_character_relations" ADD CONSTRAINT "game_character_relations_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_character_relations" ADD CONSTRAINT "game_character_relations_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "game_characters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_download_resources" ADD CONSTRAINT "game_download_resources_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_download_resources" ADD CONSTRAINT "game_download_resources_upload_session_id_fkey" FOREIGN KEY ("upload_session_id") REFERENCES "game_upload_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_download_resources" ADD CONSTRAINT "game_download_resources_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_download_resource_files" ADD CONSTRAINT "game_download_resource_files_upload_session_id_fkey" FOREIGN KEY ("upload_session_id") REFERENCES "game_upload_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_download_resource_files" ADD CONSTRAINT "game_download_resource_files_game_download_resource_id_fkey" FOREIGN KEY ("game_download_resource_id") REFERENCES "game_download_resources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_download_resource_files" ADD CONSTRAINT "game_download_resource_files_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_favorite_relations" ADD CONSTRAINT "game_favorite_relations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_favorite_relations" ADD CONSTRAINT "game_favorite_relations_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_root_id_fkey" FOREIGN KEY ("root_id") REFERENCES "comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_upload_sessions" ADD CONSTRAINT "game_upload_sessions_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_upload_chunks" ADD CONSTRAINT "game_upload_chunks_game_upload_session_id_fkey" FOREIGN KEY ("game_upload_session_id") REFERENCES "game_upload_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_upload_quotas" ADD CONSTRAINT "user_upload_quotas_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_upload_quota_records" ADD CONSTRAINT "user_upload_quota_records_upload_session_id_fkey" FOREIGN KEY ("upload_session_id") REFERENCES "game_upload_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_upload_quota_records" ADD CONSTRAINT "user_upload_quota_records_user_upload_quota_id_fkey" FOREIGN KEY ("user_upload_quota_id") REFERENCES "user_upload_quotas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_field_permissions" ADD CONSTRAINT "user_field_permissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "edit_records" ADD CONSTRAINT "edit_records_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_user_like_comment" ADD CONSTRAINT "_user_like_comment_A_fkey" FOREIGN KEY ("A") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_user_like_comment" ADD CONSTRAINT "_user_like_comment_B_fkey" FOREIGN KEY ("B") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

