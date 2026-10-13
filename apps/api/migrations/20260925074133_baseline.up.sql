CREATE TYPE public."ActivityType" AS ENUM (
    'COMMENT',
    'FILE_UPLOAD_TO_SERVER',
    'FILE_UPLOAD_TO_S3',
    'FILE_CHECK_OK',
    'FILE_CHECK_BROKEN_OR_TRUNCATED',
    'FILE_CHECK_BROKEN_OR_UNSUPPORTED',
    'FILE_CHECK_ENCRYPTED',
    'FILE_CHECK_HARMFUL',
    'GAME_EDIT',
    'DEVELOPER_EDIT',
    'CHARACTER_EDIT',
    'GAME_CREATE',
    'FILE_REUPLOAD',
    'WALKTHROUGH_CREATE'
);

CREATE TYPE public."EditActionType" AS ENUM (
    'UPDATE_SCALAR',
    'ADD_RELATION',
    'REMOVE_RELATION',
    'SET_RELATION',
    'UPDATE_RELATION'
);

CREATE TYPE public."EditRelationType" AS ENUM (
    'cover',
    'image',
    'link',
    'developer',
    'character',
    'game_relation'
);

CREATE TYPE public."GameCharacterBloodType" AS ENUM (
    'a',
    'b',
    'ab',
    'o'
);

CREATE TYPE public."GameCharacterGender" AS ENUM (
    'm',
    'f',
    'o',
    'a'
);

CREATE TYPE public."GameCharacterRole" AS ENUM (
    'main',
    'primary',
    'side',
    'appears'
);

CREATE TYPE public."GameDownloadResourceReportReason" AS ENUM (
    'MALWARE',
    'IRRELEVANT',
    'BROKEN_LINK',
    'MISLEADING_CONTENT',
    'OTHER'
);

CREATE TYPE public."GameDownloadResourceReportStatus" AS ENUM (
    'PENDING',
    'VALID',
    'INVALID'
);

CREATE TYPE public."GameDownloadResourceSimulator" AS ENUM (
    'KRKR',
    'ONS',
    'ARTEMIS',
    'OTHER'
);

CREATE TYPE public."GameRelationType" AS ENUM (
    'SEQUEL',
    'PREQUEL',
    'SIDE_STORY',
    'MAIN_STORY',
    'VARIANT',
    'MAIN_VERSION',
    'COLLECTION',
    'COLLECTED_WORK',
    'SAME_UNIVERSE',
    'DIFFERENT_ADAPTATION',
    'EXPANSION'
);

CREATE TYPE public."GameUploadSessionStatus" AS ENUM (
    'INITIATED',
    'UPLOADING',
    'COMPLETED',
    'ABORTED',
    'EXPIRED'
);

CREATE TYPE public."HashAlgorithm" AS ENUM (
    'sha256',
    'blake3'
);

CREATE TYPE public."MalwareScanCaseStatus" AS ENUM (
    'PENDING',
    'RELEASED_FALSE_POSITIVE',
    'DELETED'
);

CREATE TYPE public."MalwareScanDecisionSource" AS ENUM (
    'ADMIN_ALLOW',
    'ADMIN_DELETE',
    'TIMEOUT_AUTO_DELETE'
);

CREATE TYPE public."MessageTone" AS ENUM (
    'PRIMARY',
    'SECONDARY',
    'SUCCESS',
    'WARNING',
    'INFO',
    'DESTRUCTIVE',
    'NEUTRAL'
);

CREATE TYPE public."MessageType" AS ENUM (
    'COMMENT_REPLY',
    'COMMENT_LIKE',
    'SYSTEM'
);

CREATE TYPE public."ModerateCategoryKey" AS ENUM (
    'HARASSMENT',
    'HARASSMENT_THREATENING',
    'SEXUAL',
    'SEXUAL_MINORS',
    'HATE',
    'HATE_THREATENING',
    'ILLICIT',
    'ILLICIT_VIOLENT',
    'SELF_HARM',
    'SELF_HARM_INTENT',
    'SELF_HARM_INSTRUCTIONS',
    'VIOLENCE',
    'VIOLENCE_GRAPHIC',
    'SPAM',
    'MEANINGLESS'
);

CREATE TYPE public."ModerationDecision" AS ENUM (
    'ALLOW',
    'BLOCK',
    'REVIEW'
);

CREATE TYPE public."PermissionEntity" AS ENUM (
    'game',
    'character',
    'developer'
);

CREATE TYPE public."ReportMaliciousLevel" AS ENUM (
    'LOW',
    'MEDIUM',
    'HIGH',
    'CRITICAL'
);

CREATE TYPE public."SponsorOrderStatus" AS ENUM (
    'NEW',
    'DONE',
    'EXPIRED',
    'REFUND'
);

CREATE TYPE public."UserLang" AS ENUM (
    'en',
    'zh',
    'ja'
);

CREATE TYPE public."UserUploadQuotaRecordAction" AS ENUM (
    'ADD',
    'SUB',
    'USE'
);

CREATE TYPE public."UserUploadQuotaRecordField" AS ENUM (
    'SIZE',
    'USED'
);

CREATE TYPE public."UserUploadQuotaRecordStatus" AS ENUM (
    'COMPLETED',
    'WITHDRAWN'
);

CREATE TYPE public."WalkthroughStatus" AS ENUM (
    'DRAFT',
    'PUBLISHED',
    'HIDDEN',
    'DELETED'
);

CREATE TABLE public._user_like_comment (
    "A" integer NOT NULL,
    "B" integer NOT NULL
);

CREATE TABLE public.activities (
    id integer NOT NULL,
    type public."ActivityType" NOT NULL,
    user_id integer NOT NULL,
    game_id integer,
    developer_id integer,
    character_id integer,
    file_id integer,
    file_status integer DEFAULT 1,
    file_check_status integer DEFAULT 0,
    created timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated timestamp(3) without time zone NOT NULL,
    comment_id integer,
    edit_record_id integer,
    file_name text,
    file_size bigint,
    walkthrough_id integer
);

CREATE SEQUENCE public.activities_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.activities_id_seq OWNED BY public.activities.id;

CREATE TABLE public.ads (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    image_zh character varying(500) NOT NULL,
    image_ja character varying(500),
    image_en character varying(500),
    aspect character varying(20) NOT NULL,
    link character varying(500) NOT NULL,
    exclude_locales text[] DEFAULT ARRAY[]::text[],
    enabled boolean DEFAULT true NOT NULL,
    sort integer DEFAULT 0 NOT NULL,
    start_at timestamp(3) without time zone,
    end_at timestamp(3) without time zone,
    created timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated timestamp(3) without time zone NOT NULL,
    placement text[] DEFAULT ARRAY[]::text[]
);

CREATE SEQUENCE public.ads_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.ads_id_seq OWNED BY public.ads.id;

CREATE TABLE public.comments (
    id integer NOT NULL,
    content jsonb NOT NULL,
    html character varying(100000),
    game_id integer NOT NULL,
    parent_id integer,
    root_id integer,
    reply_count integer DEFAULT 0 NOT NULL,
    creator_id integer NOT NULL,
    status integer DEFAULT 1 NOT NULL,
    edited boolean DEFAULT false NOT NULL,
    created timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated timestamp(3) without time zone NOT NULL
);

CREATE SEQUENCE public.comments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.comments_id_seq OWNED BY public.comments.id;

CREATE TABLE public.edit_records (
    id integer NOT NULL,
    entity public."PermissionEntity" NOT NULL,
    target_id integer NOT NULL,
    action public."EditActionType" NOT NULL,
    actor_id integer NOT NULL,
    actor_role integer NOT NULL,
    field_mask bigint DEFAULT 0 NOT NULL,
    field_changes text[],
    changes jsonb,
    relation_type public."EditRelationType",
    note character varying(255),
    created timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated timestamp(3) without time zone NOT NULL,
    undo boolean DEFAULT false NOT NULL,
    undo_of_id integer
);

CREATE SEQUENCE public.edit_records_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.edit_records_id_seq OWNED BY public.edit_records.id;

CREATE TABLE public.favorite_items (
    id integer NOT NULL,
    favorite_id integer NOT NULL,
    game_id integer NOT NULL,
    note character varying(2000),
    created timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated timestamp(3) without time zone NOT NULL
);

CREATE SEQUENCE public.favorite_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.favorite_items_id_seq OWNED BY public.favorite_items.id;

CREATE TABLE public.favorites (
    id integer NOT NULL,
    user_id integer NOT NULL,
    name character varying(255) NOT NULL,
    description character varying(2000),
    created timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated timestamp(3) without time zone NOT NULL,
    "default" boolean DEFAULT false NOT NULL,
    is_private boolean DEFAULT false NOT NULL
);

CREATE SEQUENCE public.favorites_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.favorites_id_seq OWNED BY public.favorites.id;

CREATE TABLE public.field_permission_mappings (
    id integer NOT NULL,
    entity public."PermissionEntity" NOT NULL,
    field text NOT NULL,
    "bitIndex" integer NOT NULL,
    "isRelation" boolean DEFAULT false NOT NULL,
    created timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated timestamp(3) without time zone NOT NULL
);

CREATE SEQUENCE public.field_permission_mappings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.field_permission_mappings_id_seq OWNED BY public.field_permission_mappings.id;

CREATE TABLE public.game_character_relations (
    id integer NOT NULL,
    image text,
    actor text,
    role public."GameCharacterRole",
    game_id integer NOT NULL,
    character_id integer NOT NULL,
    created timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated timestamp(3) without time zone NOT NULL
);

CREATE SEQUENCE public.game_character_relations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.game_character_relations_id_seq OWNED BY public.game_character_relations.id;

CREATE TABLE public.game_characters (
    id integer NOT NULL,
    b_id text,
    v_id text,
    image text,
    name_jp text DEFAULT ''::text NOT NULL,
    name_zh text,
    name_en text,
    aliases text[] DEFAULT ARRAY[]::text[],
    intro_jp character varying(20000) DEFAULT ''::character varying NOT NULL,
    intro_zh character varying(20000) DEFAULT ''::character varying NOT NULL,
    intro_en character varying(20000) DEFAULT ''::character varying NOT NULL,
    blood_type public."GameCharacterBloodType",
    height integer,
    weight integer,
    bust integer,
    waist integer,
    hips integer,
    cup text,
    age integer,
    birthday integer[],
    gender public."GameCharacterGender"[] DEFAULT ARRAY[]::public."GameCharacterGender"[],
    created timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated timestamp(3) without time zone NOT NULL,
    h_id integer
);

CREATE SEQUENCE public.game_characters_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.game_characters_id_seq OWNED BY public.game_characters.id;

CREATE TABLE public.game_covers (
    id integer NOT NULL,
    language text NOT NULL,
    url text NOT NULL,
    type text NOT NULL,
    dims integer[],
    sexual integer NOT NULL,
    violence integer NOT NULL,
    created timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated timestamp(3) without time zone NOT NULL,
    game_id integer NOT NULL,
    source text,
    source_key text,
    source_url text
);

CREATE SEQUENCE public.game_covers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.game_covers_id_seq OWNED BY public.game_covers.id;

CREATE TABLE public.game_developer_relations (
    id integer NOT NULL,
    role text,
    game_id integer NOT NULL,
    developer_id integer NOT NULL,
    created timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated timestamp(3) without time zone NOT NULL
);

CREATE SEQUENCE public.game_developer_relations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.game_developer_relations_id_seq OWNED BY public.game_developer_relations.id;

CREATE TABLE public.game_developers (
    id integer NOT NULL,
    b_id text,
    v_id text,
    name character varying(255) DEFAULT ''::character varying NOT NULL,
    aliases text[] DEFAULT ARRAY[]::text[],
    logo text,
    intro_jp character varying(20000) DEFAULT ''::character varying NOT NULL,
    intro_zh character varying(20000) DEFAULT ''::character varying NOT NULL,
    intro_en character varying(20000) DEFAULT ''::character varying NOT NULL,
    extra_info jsonb DEFAULT '[]'::jsonb,
    created timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated timestamp(3) without time zone NOT NULL,
    website text,
    parent_developer_id integer,
    h_id integer
);

CREATE SEQUENCE public.game_developers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.game_developers_id_seq OWNED BY public.game_developers.id;

CREATE TABLE public.game_download_resource_file_histories (
    id integer NOT NULL,
    file_id integer NOT NULL,
    file_size bigint NOT NULL,
    hash_algorithm public."HashAlgorithm" NOT NULL,
    file_hash text NOT NULL,
    s3_file_key text,
    reason character varying(500),
    upload_session_id integer,
    operator_id integer NOT NULL,
    created timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE SEQUENCE public.game_download_resource_file_histories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.game_download_resource_file_histories_id_seq OWNED BY public.game_download_resource_file_histories.id;

CREATE TABLE public.game_download_resource_files (
    id integer NOT NULL,
    type integer NOT NULL,
    file_name text NOT NULL,
    file_path text,
    file_size bigint NOT NULL,
    file_url text,
    s3_file_key text,
    file_content_type text,
    file_hash text NOT NULL,
    upload_session_id integer,
    file_status integer DEFAULT 1 NOT NULL,
    file_check_status integer DEFAULT 0 NOT NULL,
    game_download_resource_id integer NOT NULL,
    creator_id integer NOT NULL,
    created timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated timestamp(3) without time zone NOT NULL,
    hash_algorithm public."HashAlgorithm" DEFAULT 'sha256'::public."HashAlgorithm" NOT NULL,
    is_virus_false_positive boolean DEFAULT false NOT NULL
);

CREATE SEQUENCE public.game_download_resource_files_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.game_download_resource_files_id_seq OWNED BY public.game_download_resource_files.id;

CREATE TABLE public.game_download_resource_reports (
    id integer NOT NULL,
    resource_id integer NOT NULL,
    reporter_id integer NOT NULL,
    reported_user_id integer NOT NULL,
    reason public."GameDownloadResourceReportReason" NOT NULL,
    detail character varying(500),
    status public."GameDownloadResourceReportStatus" DEFAULT 'PENDING'::public."GameDownloadResourceReportStatus" NOT NULL,
    malicious_level public."ReportMaliciousLevel" NOT NULL,
    processed_by integer,
    processed_at timestamp(3) without time zone,
    process_note character varying(500),
    reporter_penalty_applied boolean DEFAULT false NOT NULL,
    reported_penalty_applied boolean DEFAULT false NOT NULL,
    created timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated timestamp(3) without time zone NOT NULL
);

CREATE SEQUENCE public.game_download_resource_reports_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.game_download_resource_reports_id_seq OWNED BY public.game_download_resource_reports.id;

CREATE TABLE public.game_download_resources (
    id integer NOT NULL,
    game_id integer NOT NULL,
    platform text[] DEFAULT ARRAY[]::text[],
    language text[] DEFAULT ARRAY[]::text[],
    note character varying(255),
    downloads integer DEFAULT 0 NOT NULL,
    upload_session_id integer,
    creator_id integer NOT NULL,
    created timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated timestamp(3) without time zone NOT NULL,
    status integer DEFAULT 1 NOT NULL,
    simulator public."GameDownloadResourceSimulator"
);

CREATE SEQUENCE public.game_download_resources_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.game_download_resources_id_seq OWNED BY public.game_download_resources.id;

CREATE TABLE public.game_images (
    id integer NOT NULL,
    url text NOT NULL,
    dims integer[],
    sexual integer NOT NULL,
    violence integer NOT NULL,
    created timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated timestamp(3) without time zone NOT NULL,
    game_id integer NOT NULL,
    source text,
    source_key text,
    source_url text
);

CREATE SEQUENCE public.game_images_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.game_images_id_seq OWNED BY public.game_images.id;

CREATE TABLE public.game_links (
    id integer NOT NULL,
    url text NOT NULL,
    label text NOT NULL,
    name text NOT NULL,
    created timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated timestamp(3) without time zone NOT NULL,
    game_id integer NOT NULL
);

CREATE SEQUENCE public.game_links_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.game_links_id_seq OWNED BY public.game_links.id;

CREATE TABLE public.game_relations (
    id integer NOT NULL,
    from_game_id integer NOT NULL,
    to_game_id integer NOT NULL,
    relation public."GameRelationType" NOT NULL,
    created timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated timestamp(3) without time zone NOT NULL
);

CREATE SEQUENCE public.game_relations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.game_relations_id_seq OWNED BY public.game_relations.id;

CREATE TABLE public.game_tag_relations (
    game_id integer NOT NULL,
    tag_id integer NOT NULL,
    tag_alias text
);

CREATE TABLE public.game_upload_chunks (
    id integer NOT NULL,
    game_upload_session_id integer NOT NULL,
    index integer NOT NULL,
    size integer NOT NULL,
    sha256 text NOT NULL,
    created timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated timestamp(3) without time zone NOT NULL
);

CREATE SEQUENCE public.game_upload_chunks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.game_upload_chunks_id_seq OWNED BY public.game_upload_chunks.id;

CREATE TABLE public.game_upload_sessions (
    id integer NOT NULL,
    file_name text NOT NULL,
    mime_type text,
    total_size bigint NOT NULL,
    chunk_size integer NOT NULL,
    total_chunks integer NOT NULL,
    uploaded_chunks integer[] DEFAULT ARRAY[]::integer[],
    file_sha256 text NOT NULL,
    status public."GameUploadSessionStatus" NOT NULL,
    storage_path text NOT NULL,
    expires_at timestamp(3) without time zone NOT NULL,
    creator_id integer NOT NULL,
    created timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated timestamp(3) without time zone NOT NULL,
    hash_algorithm public."HashAlgorithm" DEFAULT 'sha256'::public."HashAlgorithm" NOT NULL
);

CREATE SEQUENCE public.game_upload_sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.game_upload_sessions_id_seq OWNED BY public.game_upload_sessions.id;

CREATE TABLE public.games (
    id integer NOT NULL,
    v_id text,
    b_id text,
    title_jp character varying(255) DEFAULT ''::character varying NOT NULL,
    title_zh character varying(255) DEFAULT ''::character varying NOT NULL,
    title_en character varying(255) DEFAULT ''::character varying NOT NULL,
    aliases text[] DEFAULT ARRAY[]::text[],
    intro_jp character varying(20000) DEFAULT ''::character varying NOT NULL,
    intro_zh character varying(20000) DEFAULT ''::character varying NOT NULL,
    intro_en character varying(20000) DEFAULT ''::character varying NOT NULL,
    release_date timestamp(3) without time zone,
    extra_info jsonb DEFAULT '[]'::jsonb,
    staffs jsonb DEFAULT '[]'::jsonb,
    nsfw boolean DEFAULT false NOT NULL,
    type text,
    platform text[] DEFAULT ARRAY[]::text[],
    views integer DEFAULT 0 NOT NULL,
    creator_id integer NOT NULL,
    status integer DEFAULT 1 NOT NULL,
    created timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated timestamp(3) without time zone NOT NULL,
    downloads integer DEFAULT 0 NOT NULL,
    hot_score double precision DEFAULT 0 NOT NULL,
    release_date_tba boolean DEFAULT false NOT NULL,
    h_id integer
);

CREATE SEQUENCE public.games_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.games_id_seq OWNED BY public.games.id;

CREATE TABLE public.hikarinagi_sync_state (
    id integer DEFAULT 1 NOT NULL,
    last_event_id bigint DEFAULT 0 NOT NULL,
    synced_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE public.malware_scan_cases (
    id integer NOT NULL,
    file_id integer,
    resource_id integer,
    game_id integer,
    uploader_id integer NOT NULL,
    reviewed_by integer,
    status public."MalwareScanCaseStatus" DEFAULT 'PENDING'::public."MalwareScanCaseStatus" NOT NULL,
    decision_source public."MalwareScanDecisionSource",
    review_note character varying(500),
    review_deadline timestamp(3) without time zone NOT NULL,
    reviewed_at timestamp(3) without time zone,
    detector character varying(64) NOT NULL,
    detected_viruses text[] DEFAULT ARRAY[]::text[],
    scan_result jsonb,
    scan_log_path character varying(255),
    scan_log_excerpt text,
    notify_uploader_on_allow boolean DEFAULT true NOT NULL,
    uploader_notified_at timestamp(3) without time zone,
    file_name text NOT NULL,
    file_size bigint NOT NULL,
    hash_algorithm public."HashAlgorithm",
    file_hash text NOT NULL,
    created timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated timestamp(3) without time zone NOT NULL
);

CREATE SEQUENCE public.malware_scan_cases_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.malware_scan_cases_id_seq OWNED BY public.malware_scan_cases.id;

CREATE TABLE public.messages (
    id integer NOT NULL,
    type public."MessageType" NOT NULL,
    title character varying(255) NOT NULL,
    content character varying(10240) NOT NULL,
    link_text character varying(255),
    link_url character varying(255),
    external_link boolean DEFAULT false NOT NULL,
    comment_id integer,
    game_id integer,
    sender_id integer,
    receiver_id integer NOT NULL,
    read boolean DEFAULT false NOT NULL,
    read_at timestamp(3) without time zone,
    created timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated timestamp(3) without time zone NOT NULL,
    meta jsonb,
    tone public."MessageTone" DEFAULT 'INFO'::public."MessageTone" NOT NULL
);

CREATE SEQUENCE public.messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.messages_id_seq OWNED BY public.messages.id;

CREATE TABLE public.moderation_events (
    id integer NOT NULL,
    audit_by integer DEFAULT 1 NOT NULL,
    model text DEFAULT 'omni-moderation-latest'::text NOT NULL,
    decision public."ModerationDecision" DEFAULT 'REVIEW'::public."ModerationDecision" NOT NULL,
    top_category public."ModerateCategoryKey" NOT NULL,
    categories_json jsonb NOT NULL,
    max_score numeric(6,5),
    scores_json jsonb,
    reason character varying(2550),
    evidence character varying(1000),
    comment_id integer,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    walkthrough_id integer
);

CREATE SEQUENCE public.moderation_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.moderation_events_id_seq OWNED BY public.moderation_events.id;

CREATE TABLE public.oidc_identities (
    id integer NOT NULL,
    user_id integer NOT NULL,
    provider character varying(32) NOT NULL,
    subject character varying(255) NOT NULL,
    email_at_link character varying(255),
    last_login_at timestamp(3) without time zone,
    created timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated timestamp(3) without time zone NOT NULL
);

CREATE SEQUENCE public.oidc_identities_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.oidc_identities_id_seq OWNED BY public.oidc_identities.id;

CREATE TABLE public.role_field_permissions (
    id integer NOT NULL,
    role integer NOT NULL,
    entity public."PermissionEntity" NOT NULL,
    "allowMask" bigint DEFAULT 0 NOT NULL,
    created timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated timestamp(3) without time zone NOT NULL
);

CREATE SEQUENCE public.role_field_permissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.role_field_permissions_id_seq OWNED BY public.role_field_permissions.id;

CREATE TABLE public.sponsor_orders (
    id integer NOT NULL,
    provider_order_id character varying(255) NOT NULL,
    provider character varying(50) DEFAULT 'idatariver'::character varying NOT NULL,
    amount numeric(10,2) NOT NULL,
    currency character varying(10),
    payment_method character varying(50),
    status public."SponsorOrderStatus" DEFAULT 'NEW'::public."SponsorOrderStatus" NOT NULL,
    sponsor_name character varying(100),
    sponsor_message text,
    is_private boolean DEFAULT false NOT NULL,
    user_id integer,
    paid_at timestamp(3) without time zone,
    callback_verified boolean DEFAULT false NOT NULL,
    created timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated timestamp(3) without time zone NOT NULL,
    expires_at timestamp(3) without time zone
);

CREATE SEQUENCE public.sponsor_orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.sponsor_orders_id_seq OWNED BY public.sponsor_orders.id;

CREATE TABLE public.tags (
    id integer NOT NULL,
    name text NOT NULL,
    aliases text[] DEFAULT ARRAY[]::text[],
    count integer DEFAULT 0 NOT NULL,
    created timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated timestamp(3) without time zone NOT NULL
);

CREATE SEQUENCE public.tags_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.tags_id_seq OWNED BY public.tags.id;

CREATE TABLE public.user_banned_records (
    id integer NOT NULL,
    user_id integer NOT NULL,
    banned_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    banned_reason character varying(255),
    banned_by integer,
    banned_duration_days integer,
    is_permanent boolean DEFAULT false NOT NULL,
    unbanned_at timestamp(3) without time zone
);

CREATE SEQUENCE public.user_banned_records_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.user_banned_records_id_seq OWNED BY public.user_banned_records.id;

CREATE TABLE public.user_field_permissions (
    id integer NOT NULL,
    user_id integer NOT NULL,
    entity public."PermissionEntity" NOT NULL,
    "allowMask" bigint DEFAULT 0 NOT NULL,
    created timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated timestamp(3) without time zone NOT NULL
);

CREATE SEQUENCE public.user_field_permissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.user_field_permissions_id_seq OWNED BY public.user_field_permissions.id;

CREATE TABLE public.user_game_pvn_mappings (
    id integer NOT NULL,
    user_id integer NOT NULL,
    game_id integer NOT NULL,
    pvn_galgame_id integer NOT NULL,
    total_play_time integer DEFAULT 0 NOT NULL,
    last_play_date timestamp(3) without time zone,
    play_type integer DEFAULT 0 NOT NULL,
    my_rate integer DEFAULT 0 NOT NULL,
    synced_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated timestamp(3) without time zone NOT NULL
);

CREATE SEQUENCE public.user_game_pvn_mappings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.user_game_pvn_mappings_id_seq OWNED BY public.user_game_pvn_mappings.id;

CREATE TABLE public.user_login_sessions (
    id integer NOT NULL,
    user_id integer NOT NULL,
    refresh_token_hash character varying(255) NOT NULL,
    refresh_token_prefix character varying(32) NOT NULL,
    status integer DEFAULT 1 NOT NULL,
    family_id uuid DEFAULT gen_random_uuid() NOT NULL,
    replaced_by_id integer,
    expires_at timestamp(3) without time zone NOT NULL,
    last_used_at timestamp(3) without time zone,
    rotated_at timestamp(3) without time zone,
    reused_at timestamp(3) without time zone,
    blocked_at timestamp(3) without time zone,
    blocked_reason character varying(255),
    ip text,
    user_agent text,
    device_info text,
    created timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated timestamp(3) without time zone NOT NULL
);

CREATE SEQUENCE public.user_login_sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.user_login_sessions_id_seq OWNED BY public.user_login_sessions.id;

CREATE TABLE public.user_passkey_credentials (
    id integer NOT NULL,
    user_id integer NOT NULL,
    credential_id character varying(512) NOT NULL,
    public_key text NOT NULL,
    counter integer DEFAULT 0 NOT NULL,
    transports text[] DEFAULT ARRAY[]::text[],
    aaguid character varying(64),
    device_type character varying(32),
    credential_backed_up boolean DEFAULT false NOT NULL,
    name character varying(128),
    last_used_at timestamp(3) without time zone,
    revoked_at timestamp(3) without time zone,
    created timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated timestamp(3) without time zone NOT NULL
);

CREATE SEQUENCE public.user_passkey_credentials_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.user_passkey_credentials_id_seq OWNED BY public.user_passkey_credentials.id;

CREATE TABLE public.user_pvn_bindings (
    id integer NOT NULL,
    user_id integer NOT NULL,
    pvn_user_id integer NOT NULL,
    pvn_user_name character varying(255) NOT NULL,
    pvn_user_avatar character varying(255),
    pvn_token text NOT NULL,
    pvn_token_expires timestamp(3) without time zone NOT NULL,
    created timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated timestamp(3) without time zone NOT NULL
);

CREATE SEQUENCE public.user_pvn_bindings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.user_pvn_bindings_id_seq OWNED BY public.user_pvn_bindings.id;

CREATE TABLE public.user_upload_quota_records (
    id integer NOT NULL,
    field public."UserUploadQuotaRecordField" NOT NULL,
    amount bigint NOT NULL,
    action public."UserUploadQuotaRecordAction" NOT NULL,
    action_reason character varying(255),
    status public."UserUploadQuotaRecordStatus" DEFAULT 'COMPLETED'::public."UserUploadQuotaRecordStatus" NOT NULL,
    upload_session_id integer,
    user_upload_quota_id integer NOT NULL,
    created timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated timestamp(3) without time zone NOT NULL
);

CREATE SEQUENCE public.user_upload_quota_records_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.user_upload_quota_records_id_seq OWNED BY public.user_upload_quota_records.id;

CREATE TABLE public.user_upload_quotas (
    id integer NOT NULL,
    size bigint NOT NULL,
    used bigint NOT NULL,
    user_id integer NOT NULL,
    created timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated timestamp(3) without time zone NOT NULL,
    is_first_grant boolean DEFAULT false NOT NULL
);

CREATE SEQUENCE public.user_upload_quotas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.user_upload_quotas_id_seq OWNED BY public.user_upload_quotas.id;

CREATE TABLE public.users (
    id integer NOT NULL,
    name character varying(20) NOT NULL,
    email character varying(255) NOT NULL,
    password character varying(255),
    avatar text,
    cover text,
    lang public."UserLang" DEFAULT 'en'::public."UserLang" NOT NULL,
    role integer DEFAULT 1 NOT NULL,
    status integer DEFAULT 1 NOT NULL,
    email_verified_at timestamp(3) without time zone,
    last_login_at timestamp(3) without time zone,
    two_factor_enabled boolean DEFAULT false NOT NULL,
    created timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated timestamp(3) without time zone NOT NULL,
    content_limit integer DEFAULT 2 NOT NULL,
    upload_injected_file_times integer DEFAULT 0 NOT NULL,
    bio text,
    sponsor_expires_at timestamp(3) without time zone,
    only_games_with_resources boolean DEFAULT true NOT NULL
);

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;

CREATE TABLE public.walkthroughs (
    id integer NOT NULL,
    game_id integer NOT NULL,
    title character varying(255) NOT NULL,
    content jsonb NOT NULL,
    html character varying(100000) NOT NULL,
    created timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated timestamp(3) without time zone NOT NULL,
    edited boolean DEFAULT false NOT NULL,
    status public."WalkthroughStatus" DEFAULT 'DRAFT'::public."WalkthroughStatus" NOT NULL,
    creator_id integer NOT NULL,
    lang character varying(16)
);

CREATE SEQUENCE public.walkthroughs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.walkthroughs_id_seq OWNED BY public.walkthroughs.id;

ALTER TABLE ONLY public.activities ALTER COLUMN id SET DEFAULT nextval('public.activities_id_seq'::regclass);

ALTER TABLE ONLY public.ads ALTER COLUMN id SET DEFAULT nextval('public.ads_id_seq'::regclass);

ALTER TABLE ONLY public.comments ALTER COLUMN id SET DEFAULT nextval('public.comments_id_seq'::regclass);

ALTER TABLE ONLY public.edit_records ALTER COLUMN id SET DEFAULT nextval('public.edit_records_id_seq'::regclass);

ALTER TABLE ONLY public.favorite_items ALTER COLUMN id SET DEFAULT nextval('public.favorite_items_id_seq'::regclass);

ALTER TABLE ONLY public.favorites ALTER COLUMN id SET DEFAULT nextval('public.favorites_id_seq'::regclass);

ALTER TABLE ONLY public.field_permission_mappings ALTER COLUMN id SET DEFAULT nextval('public.field_permission_mappings_id_seq'::regclass);

ALTER TABLE ONLY public.game_character_relations ALTER COLUMN id SET DEFAULT nextval('public.game_character_relations_id_seq'::regclass);

ALTER TABLE ONLY public.game_characters ALTER COLUMN id SET DEFAULT nextval('public.game_characters_id_seq'::regclass);

ALTER TABLE ONLY public.game_covers ALTER COLUMN id SET DEFAULT nextval('public.game_covers_id_seq'::regclass);

ALTER TABLE ONLY public.game_developer_relations ALTER COLUMN id SET DEFAULT nextval('public.game_developer_relations_id_seq'::regclass);

ALTER TABLE ONLY public.game_developers ALTER COLUMN id SET DEFAULT nextval('public.game_developers_id_seq'::regclass);

ALTER TABLE ONLY public.game_download_resource_file_histories ALTER COLUMN id SET DEFAULT nextval('public.game_download_resource_file_histories_id_seq'::regclass);

ALTER TABLE ONLY public.game_download_resource_files ALTER COLUMN id SET DEFAULT nextval('public.game_download_resource_files_id_seq'::regclass);

ALTER TABLE ONLY public.game_download_resource_reports ALTER COLUMN id SET DEFAULT nextval('public.game_download_resource_reports_id_seq'::regclass);

ALTER TABLE ONLY public.game_download_resources ALTER COLUMN id SET DEFAULT nextval('public.game_download_resources_id_seq'::regclass);

ALTER TABLE ONLY public.game_images ALTER COLUMN id SET DEFAULT nextval('public.game_images_id_seq'::regclass);

ALTER TABLE ONLY public.game_links ALTER COLUMN id SET DEFAULT nextval('public.game_links_id_seq'::regclass);

ALTER TABLE ONLY public.game_relations ALTER COLUMN id SET DEFAULT nextval('public.game_relations_id_seq'::regclass);

ALTER TABLE ONLY public.game_upload_chunks ALTER COLUMN id SET DEFAULT nextval('public.game_upload_chunks_id_seq'::regclass);

ALTER TABLE ONLY public.game_upload_sessions ALTER COLUMN id SET DEFAULT nextval('public.game_upload_sessions_id_seq'::regclass);

ALTER TABLE ONLY public.games ALTER COLUMN id SET DEFAULT nextval('public.games_id_seq'::regclass);

ALTER TABLE ONLY public.malware_scan_cases ALTER COLUMN id SET DEFAULT nextval('public.malware_scan_cases_id_seq'::regclass);

ALTER TABLE ONLY public.messages ALTER COLUMN id SET DEFAULT nextval('public.messages_id_seq'::regclass);

ALTER TABLE ONLY public.moderation_events ALTER COLUMN id SET DEFAULT nextval('public.moderation_events_id_seq'::regclass);

ALTER TABLE ONLY public.oidc_identities ALTER COLUMN id SET DEFAULT nextval('public.oidc_identities_id_seq'::regclass);

ALTER TABLE ONLY public.role_field_permissions ALTER COLUMN id SET DEFAULT nextval('public.role_field_permissions_id_seq'::regclass);

ALTER TABLE ONLY public.sponsor_orders ALTER COLUMN id SET DEFAULT nextval('public.sponsor_orders_id_seq'::regclass);

ALTER TABLE ONLY public.tags ALTER COLUMN id SET DEFAULT nextval('public.tags_id_seq'::regclass);

ALTER TABLE ONLY public.user_banned_records ALTER COLUMN id SET DEFAULT nextval('public.user_banned_records_id_seq'::regclass);

ALTER TABLE ONLY public.user_field_permissions ALTER COLUMN id SET DEFAULT nextval('public.user_field_permissions_id_seq'::regclass);

ALTER TABLE ONLY public.user_game_pvn_mappings ALTER COLUMN id SET DEFAULT nextval('public.user_game_pvn_mappings_id_seq'::regclass);

ALTER TABLE ONLY public.user_login_sessions ALTER COLUMN id SET DEFAULT nextval('public.user_login_sessions_id_seq'::regclass);

ALTER TABLE ONLY public.user_passkey_credentials ALTER COLUMN id SET DEFAULT nextval('public.user_passkey_credentials_id_seq'::regclass);

ALTER TABLE ONLY public.user_pvn_bindings ALTER COLUMN id SET DEFAULT nextval('public.user_pvn_bindings_id_seq'::regclass);

ALTER TABLE ONLY public.user_upload_quota_records ALTER COLUMN id SET DEFAULT nextval('public.user_upload_quota_records_id_seq'::regclass);

ALTER TABLE ONLY public.user_upload_quotas ALTER COLUMN id SET DEFAULT nextval('public.user_upload_quotas_id_seq'::regclass);

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);

ALTER TABLE ONLY public.walkthroughs ALTER COLUMN id SET DEFAULT nextval('public.walkthroughs_id_seq'::regclass);

ALTER TABLE ONLY public._user_like_comment
    ADD CONSTRAINT "_user_like_comment_AB_pkey" PRIMARY KEY ("A", "B");

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.ads
    ADD CONSTRAINT ads_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.edit_records
    ADD CONSTRAINT edit_records_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.favorite_items
    ADD CONSTRAINT favorite_items_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.favorites
    ADD CONSTRAINT favorites_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.field_permission_mappings
    ADD CONSTRAINT field_permission_mappings_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.game_character_relations
    ADD CONSTRAINT game_character_relations_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.game_characters
    ADD CONSTRAINT game_characters_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.game_covers
    ADD CONSTRAINT game_covers_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.game_developer_relations
    ADD CONSTRAINT game_developer_relations_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.game_developers
    ADD CONSTRAINT game_developers_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.game_download_resource_file_histories
    ADD CONSTRAINT game_download_resource_file_histories_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.game_download_resource_files
    ADD CONSTRAINT game_download_resource_files_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.game_download_resource_reports
    ADD CONSTRAINT game_download_resource_reports_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.game_download_resources
    ADD CONSTRAINT game_download_resources_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.game_images
    ADD CONSTRAINT game_images_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.game_links
    ADD CONSTRAINT game_links_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.game_relations
    ADD CONSTRAINT game_relations_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.game_upload_chunks
    ADD CONSTRAINT game_upload_chunks_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.game_upload_sessions
    ADD CONSTRAINT game_upload_sessions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.games
    ADD CONSTRAINT games_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.hikarinagi_sync_state
    ADD CONSTRAINT hikarinagi_sync_state_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.malware_scan_cases
    ADD CONSTRAINT malware_scan_cases_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.moderation_events
    ADD CONSTRAINT moderation_events_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.oidc_identities
    ADD CONSTRAINT oidc_identities_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.role_field_permissions
    ADD CONSTRAINT role_field_permissions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.sponsor_orders
    ADD CONSTRAINT sponsor_orders_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT tags_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.user_banned_records
    ADD CONSTRAINT user_banned_records_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.user_field_permissions
    ADD CONSTRAINT user_field_permissions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.user_game_pvn_mappings
    ADD CONSTRAINT user_game_pvn_mappings_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.user_login_sessions
    ADD CONSTRAINT user_login_sessions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.user_passkey_credentials
    ADD CONSTRAINT user_passkey_credentials_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.user_pvn_bindings
    ADD CONSTRAINT user_pvn_bindings_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.user_upload_quota_records
    ADD CONSTRAINT user_upload_quota_records_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.user_upload_quotas
    ADD CONSTRAINT user_upload_quotas_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.walkthroughs
    ADD CONSTRAINT walkthroughs_pkey PRIMARY KEY (id);

CREATE INDEX "_user_like_comment_B_index" ON public._user_like_comment USING btree ("B");

CREATE INDEX activities_created_idx ON public.activities USING btree (created);

CREATE INDEX activities_walkthrough_id_created_idx ON public.activities USING btree (walkthrough_id, created);

CREATE INDEX ads_enabled_idx ON public.ads USING btree (enabled);

CREATE INDEX ads_placement_idx ON public.ads USING gin (placement);

CREATE INDEX comments_creator_id_created_idx ON public.comments USING btree (creator_id, created);

CREATE INDEX comments_game_id_created_idx ON public.comments USING btree (game_id, created);

CREATE INDEX comments_parent_id_created_idx ON public.comments USING btree (parent_id, created);

CREATE UNIQUE INDEX edit_records_undo_of_id_key ON public.edit_records USING btree (undo_of_id);

CREATE UNIQUE INDEX favorite_items_favorite_id_game_id_key ON public.favorite_items USING btree (favorite_id, game_id);

CREATE INDEX favorites_user_id_idx ON public.favorites USING btree (user_id);

CREATE UNIQUE INDEX favorites_user_id_name_key ON public.favorites USING btree (user_id, name);

CREATE UNIQUE INDEX "field_permission_mappings_entity_bitIndex_key" ON public.field_permission_mappings USING btree (entity, "bitIndex");

CREATE UNIQUE INDEX field_permission_mappings_entity_field_key ON public.field_permission_mappings USING btree (entity, field);

CREATE INDEX field_permission_mappings_entity_idx ON public.field_permission_mappings USING btree (entity);

CREATE UNIQUE INDEX game_character_relations_game_id_character_id_key ON public.game_character_relations USING btree (game_id, character_id);

CREATE INDEX game_characters_b_id_idx ON public.game_characters USING btree (b_id);

CREATE INDEX game_characters_b_id_v_id_idx ON public.game_characters USING btree (b_id, v_id);

CREATE UNIQUE INDEX game_characters_b_id_v_id_key ON public.game_characters USING btree (b_id, v_id);

CREATE UNIQUE INDEX game_characters_h_id_key ON public.game_characters USING btree (h_id);

CREATE INDEX game_characters_v_id_idx ON public.game_characters USING btree (v_id);

CREATE INDEX game_covers_source_source_key_idx ON public.game_covers USING btree (source, source_key);

CREATE UNIQUE INDEX game_developer_relations_game_id_developer_id_key ON public.game_developer_relations USING btree (game_id, developer_id);

CREATE INDEX game_developers_b_id_idx ON public.game_developers USING btree (b_id);

CREATE INDEX game_developers_b_id_v_id_idx ON public.game_developers USING btree (b_id, v_id);

CREATE UNIQUE INDEX game_developers_b_id_v_id_key ON public.game_developers USING btree (b_id, v_id);

CREATE UNIQUE INDEX game_developers_h_id_key ON public.game_developers USING btree (h_id);

CREATE INDEX game_developers_v_id_idx ON public.game_developers USING btree (v_id);

CREATE INDEX game_download_resource_file_histories_file_id_idx ON public.game_download_resource_file_histories USING btree (file_id);

CREATE INDEX game_download_resource_files_file_path_idx ON public.game_download_resource_files USING btree (file_path);

CREATE UNIQUE INDEX game_download_resource_files_file_path_key ON public.game_download_resource_files USING btree (file_path);

CREATE UNIQUE INDEX game_download_resource_files_upload_session_id_key ON public.game_download_resource_files USING btree (upload_session_id);

CREATE INDEX game_download_resource_reports_reported_user_id_status_crea_idx ON public.game_download_resource_reports USING btree (reported_user_id, status, created);

CREATE INDEX game_download_resource_reports_reporter_id_status_created_idx ON public.game_download_resource_reports USING btree (reporter_id, status, created);

CREATE INDEX game_download_resource_reports_resource_id_status_idx ON public.game_download_resource_reports USING btree (resource_id, status);

CREATE INDEX game_download_resource_reports_status_created_idx ON public.game_download_resource_reports USING btree (status, created);

CREATE INDEX game_download_resources_game_id_status_idx ON public.game_download_resources USING btree (game_id, status);

CREATE INDEX game_images_source_source_key_idx ON public.game_images USING btree (source, source_key);

CREATE INDEX game_relations_from_game_id_idx ON public.game_relations USING btree (from_game_id);

CREATE UNIQUE INDEX game_relations_from_game_id_to_game_id_key ON public.game_relations USING btree (from_game_id, to_game_id);

CREATE INDEX game_relations_to_game_id_idx ON public.game_relations USING btree (to_game_id);

CREATE UNIQUE INDEX game_tag_relations_game_id_tag_id_key ON public.game_tag_relations USING btree (game_id, tag_id);

CREATE INDEX game_tag_relations_tag_id_idx ON public.game_tag_relations USING btree (tag_id);

CREATE INDEX game_upload_chunks_game_upload_session_id_idx ON public.game_upload_chunks USING btree (game_upload_session_id);

CREATE INDEX game_upload_chunks_game_upload_session_id_index_idx ON public.game_upload_chunks USING btree (game_upload_session_id, index);

CREATE UNIQUE INDEX game_upload_chunks_game_upload_session_id_index_key ON public.game_upload_chunks USING btree (game_upload_session_id, index);

CREATE INDEX game_upload_sessions_expires_at_idx ON public.game_upload_sessions USING btree (expires_at);

CREATE INDEX game_upload_sessions_status_idx ON public.game_upload_sessions USING btree (status);

CREATE INDEX games_b_id_idx ON public.games USING btree (b_id);

CREATE INDEX games_b_id_v_id_idx ON public.games USING btree (b_id, v_id);

CREATE UNIQUE INDEX games_b_id_v_id_key ON public.games USING btree (b_id, v_id);

CREATE INDEX games_downloads_idx ON public.games USING btree (downloads);

CREATE UNIQUE INDEX games_h_id_key ON public.games USING btree (h_id);

CREATE INDEX games_hot_score_idx ON public.games USING btree (hot_score);

CREATE INDEX games_v_id_idx ON public.games USING btree (v_id);

CREATE INDEX malware_scan_cases_file_id_created_idx ON public.malware_scan_cases USING btree (file_id, created);

CREATE INDEX malware_scan_cases_game_id_created_idx ON public.malware_scan_cases USING btree (game_id, created);

CREATE INDEX malware_scan_cases_resource_id_created_idx ON public.malware_scan_cases USING btree (resource_id, created);

CREATE INDEX malware_scan_cases_status_review_deadline_idx ON public.malware_scan_cases USING btree (status, review_deadline);

CREATE INDEX malware_scan_cases_uploader_id_created_idx ON public.malware_scan_cases USING btree (uploader_id, created);

CREATE INDEX moderation_events_comment_id_created_at_idx ON public.moderation_events USING btree (comment_id, created_at);

CREATE UNIQUE INDEX oidc_identities_provider_subject_key ON public.oidc_identities USING btree (provider, subject);

CREATE INDEX oidc_identities_user_id_idx ON public.oidc_identities USING btree (user_id);

CREATE INDEX role_field_permissions_role_entity_idx ON public.role_field_permissions USING btree (role, entity);

CREATE UNIQUE INDEX role_field_permissions_role_entity_key ON public.role_field_permissions USING btree (role, entity);

CREATE INDEX sponsor_orders_created_idx ON public.sponsor_orders USING btree (created);

CREATE INDEX sponsor_orders_is_private_status_created_idx ON public.sponsor_orders USING btree (is_private, status, created);

CREATE UNIQUE INDEX sponsor_orders_provider_order_id_key ON public.sponsor_orders USING btree (provider_order_id);

CREATE INDEX sponsor_orders_status_idx ON public.sponsor_orders USING btree (status);

CREATE INDEX sponsor_orders_user_id_idx ON public.sponsor_orders USING btree (user_id);

CREATE INDEX tags_count_idx ON public.tags USING btree (count);

CREATE UNIQUE INDEX tags_name_key ON public.tags USING btree (name);

CREATE INDEX user_banned_records_user_id_banned_at_idx ON public.user_banned_records USING btree (user_id, banned_at);

CREATE INDEX user_banned_records_user_id_unbanned_at_idx ON public.user_banned_records USING btree (user_id, unbanned_at);

CREATE INDEX user_field_permissions_user_id_entity_idx ON public.user_field_permissions USING btree (user_id, entity);

CREATE UNIQUE INDEX user_field_permissions_user_id_entity_key ON public.user_field_permissions USING btree (user_id, entity);

CREATE UNIQUE INDEX user_game_pvn_mappings_user_id_game_id_key ON public.user_game_pvn_mappings USING btree (user_id, game_id);

CREATE INDEX user_game_pvn_mappings_user_id_idx ON public.user_game_pvn_mappings USING btree (user_id);

CREATE UNIQUE INDEX user_game_pvn_mappings_user_id_pvn_galgame_id_key ON public.user_game_pvn_mappings USING btree (user_id, pvn_galgame_id);

CREATE INDEX user_login_sessions_family_id_idx ON public.user_login_sessions USING btree (family_id);

CREATE UNIQUE INDEX user_login_sessions_refresh_token_prefix_key ON public.user_login_sessions USING btree (refresh_token_prefix);

CREATE INDEX user_login_sessions_status_expires_at_idx ON public.user_login_sessions USING btree (status, expires_at);

CREATE INDEX user_login_sessions_user_id_status_idx ON public.user_login_sessions USING btree (user_id, status);

CREATE UNIQUE INDEX user_passkey_credentials_credential_id_key ON public.user_passkey_credentials USING btree (credential_id);

CREATE INDEX user_passkey_credentials_last_used_at_idx ON public.user_passkey_credentials USING btree (last_used_at);

CREATE INDEX user_passkey_credentials_user_id_revoked_at_idx ON public.user_passkey_credentials USING btree (user_id, revoked_at);

CREATE INDEX user_pvn_bindings_pvn_user_id_idx ON public.user_pvn_bindings USING btree (pvn_user_id);

CREATE UNIQUE INDEX user_pvn_bindings_user_id_key ON public.user_pvn_bindings USING btree (user_id);

CREATE UNIQUE INDEX user_upload_quota_records_upload_session_id_key ON public.user_upload_quota_records USING btree (upload_session_id);

CREATE UNIQUE INDEX user_upload_quotas_user_id_key ON public.user_upload_quotas USING btree (user_id);

CREATE INDEX users_created_idx ON public.users USING btree (created);

CREATE INDEX users_email_idx ON public.users USING btree (email);

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);

CREATE INDEX users_name_idx ON public.users USING btree (name);

CREATE UNIQUE INDEX users_name_key ON public.users USING btree (name);

CREATE INDEX users_role_idx ON public.users USING btree (role);

CREATE INDEX walkthroughs_creator_id_created_idx ON public.walkthroughs USING btree (creator_id, created);

CREATE INDEX walkthroughs_game_id_created_idx ON public.walkthroughs USING btree (game_id, created);

ALTER TABLE ONLY public._user_like_comment
    ADD CONSTRAINT "_user_like_comment_A_fkey" FOREIGN KEY ("A") REFERENCES public.comments(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public._user_like_comment
    ADD CONSTRAINT "_user_like_comment_B_fkey" FOREIGN KEY ("B") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_character_id_fkey FOREIGN KEY (character_id) REFERENCES public.game_characters(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES public.comments(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_developer_id_fkey FOREIGN KEY (developer_id) REFERENCES public.game_developers(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_edit_record_id_fkey FOREIGN KEY (edit_record_id) REFERENCES public.edit_records(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_file_id_fkey FOREIGN KEY (file_id) REFERENCES public.game_download_resource_files(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.games(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_walkthrough_id_fkey FOREIGN KEY (walkthrough_id) REFERENCES public.walkthroughs(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.games(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.comments(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_root_id_fkey FOREIGN KEY (root_id) REFERENCES public.comments(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public.edit_records
    ADD CONSTRAINT edit_records_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.edit_records
    ADD CONSTRAINT edit_records_undo_of_id_fkey FOREIGN KEY (undo_of_id) REFERENCES public.edit_records(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public.favorite_items
    ADD CONSTRAINT favorite_items_favorite_id_fkey FOREIGN KEY (favorite_id) REFERENCES public.favorites(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.favorite_items
    ADD CONSTRAINT favorite_items_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.games(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.favorites
    ADD CONSTRAINT favorites_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.game_character_relations
    ADD CONSTRAINT game_character_relations_character_id_fkey FOREIGN KEY (character_id) REFERENCES public.game_characters(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public.game_character_relations
    ADD CONSTRAINT game_character_relations_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.games(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.game_covers
    ADD CONSTRAINT game_covers_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.games(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.game_developer_relations
    ADD CONSTRAINT game_developer_relations_developer_id_fkey FOREIGN KEY (developer_id) REFERENCES public.game_developers(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public.game_developer_relations
    ADD CONSTRAINT game_developer_relations_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.games(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.game_developers
    ADD CONSTRAINT game_developers_parent_developer_id_fkey FOREIGN KEY (parent_developer_id) REFERENCES public.game_developers(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public.game_download_resource_file_histories
    ADD CONSTRAINT game_download_resource_file_histories_file_id_fkey FOREIGN KEY (file_id) REFERENCES public.game_download_resource_files(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.game_download_resource_file_histories
    ADD CONSTRAINT game_download_resource_file_histories_operator_id_fkey FOREIGN KEY (operator_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public.game_download_resource_files
    ADD CONSTRAINT game_download_resource_files_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public.game_download_resource_files
    ADD CONSTRAINT game_download_resource_files_game_download_resource_id_fkey FOREIGN KEY (game_download_resource_id) REFERENCES public.game_download_resources(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.game_download_resource_files
    ADD CONSTRAINT game_download_resource_files_upload_session_id_fkey FOREIGN KEY (upload_session_id) REFERENCES public.game_upload_sessions(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public.game_download_resource_reports
    ADD CONSTRAINT game_download_resource_reports_processed_by_fkey FOREIGN KEY (processed_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public.game_download_resource_reports
    ADD CONSTRAINT game_download_resource_reports_reported_user_id_fkey FOREIGN KEY (reported_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.game_download_resource_reports
    ADD CONSTRAINT game_download_resource_reports_reporter_id_fkey FOREIGN KEY (reporter_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.game_download_resource_reports
    ADD CONSTRAINT game_download_resource_reports_resource_id_fkey FOREIGN KEY (resource_id) REFERENCES public.game_download_resources(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.game_download_resources
    ADD CONSTRAINT game_download_resources_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public.game_download_resources
    ADD CONSTRAINT game_download_resources_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.games(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.game_download_resources
    ADD CONSTRAINT game_download_resources_upload_session_id_fkey FOREIGN KEY (upload_session_id) REFERENCES public.game_upload_sessions(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public.game_images
    ADD CONSTRAINT game_images_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.games(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.game_links
    ADD CONSTRAINT game_links_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.games(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.game_relations
    ADD CONSTRAINT game_relations_from_game_id_fkey FOREIGN KEY (from_game_id) REFERENCES public.games(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.game_relations
    ADD CONSTRAINT game_relations_to_game_id_fkey FOREIGN KEY (to_game_id) REFERENCES public.games(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.game_tag_relations
    ADD CONSTRAINT game_tag_relations_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.games(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.game_tag_relations
    ADD CONSTRAINT game_tag_relations_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.tags(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.game_upload_chunks
    ADD CONSTRAINT game_upload_chunks_game_upload_session_id_fkey FOREIGN KEY (game_upload_session_id) REFERENCES public.game_upload_sessions(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public.game_upload_sessions
    ADD CONSTRAINT game_upload_sessions_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public.games
    ADD CONSTRAINT games_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public.malware_scan_cases
    ADD CONSTRAINT malware_scan_cases_file_id_fkey FOREIGN KEY (file_id) REFERENCES public.game_download_resource_files(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public.malware_scan_cases
    ADD CONSTRAINT malware_scan_cases_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.games(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public.malware_scan_cases
    ADD CONSTRAINT malware_scan_cases_resource_id_fkey FOREIGN KEY (resource_id) REFERENCES public.game_download_resources(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public.malware_scan_cases
    ADD CONSTRAINT malware_scan_cases_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public.malware_scan_cases
    ADD CONSTRAINT malware_scan_cases_uploader_id_fkey FOREIGN KEY (uploader_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES public.comments(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.games(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_receiver_id_fkey FOREIGN KEY (receiver_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.moderation_events
    ADD CONSTRAINT moderation_events_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES public.comments(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.moderation_events
    ADD CONSTRAINT moderation_events_walkthrough_id_fkey FOREIGN KEY (walkthrough_id) REFERENCES public.walkthroughs(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.oidc_identities
    ADD CONSTRAINT oidc_identities_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public.sponsor_orders
    ADD CONSTRAINT sponsor_orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public.user_banned_records
    ADD CONSTRAINT user_banned_records_banned_by_fkey FOREIGN KEY (banned_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public.user_banned_records
    ADD CONSTRAINT user_banned_records_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public.user_field_permissions
    ADD CONSTRAINT user_field_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.user_game_pvn_mappings
    ADD CONSTRAINT user_game_pvn_mappings_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.games(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.user_game_pvn_mappings
    ADD CONSTRAINT user_game_pvn_mappings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.user_login_sessions
    ADD CONSTRAINT user_login_sessions_replaced_by_id_fkey FOREIGN KEY (replaced_by_id) REFERENCES public.user_login_sessions(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public.user_login_sessions
    ADD CONSTRAINT user_login_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public.user_passkey_credentials
    ADD CONSTRAINT user_passkey_credentials_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public.user_pvn_bindings
    ADD CONSTRAINT user_pvn_bindings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.user_upload_quota_records
    ADD CONSTRAINT user_upload_quota_records_upload_session_id_fkey FOREIGN KEY (upload_session_id) REFERENCES public.game_upload_sessions(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public.user_upload_quota_records
    ADD CONSTRAINT user_upload_quota_records_user_upload_quota_id_fkey FOREIGN KEY (user_upload_quota_id) REFERENCES public.user_upload_quotas(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public.user_upload_quotas
    ADD CONSTRAINT user_upload_quotas_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.walkthroughs
    ADD CONSTRAINT walkthroughs_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.walkthroughs
    ADD CONSTRAINT walkthroughs_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.games(id) ON UPDATE CASCADE ON DELETE CASCADE;
