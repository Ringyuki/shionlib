import { AppConfig } from '../interfaces/app.interface'
import { withDefault } from '../../utils/env.util'

export default (): AppConfig => ({
  port: withDefault('PORT', 5000),
  environment: withDefault('ENVIRONMENT', 'production'),
  siteUrl: withDefault('SITE_URL', 'https://shionlib.com'),
  allowRegister: withDefault('ALLOW_REGISTER', true),

  throttle: {
    ttl: withDefault('THROTTLE_TTL_MS', 60000),
    limit: withDefault('THROTTLE_LIMIT', 600),
    blockDuration: withDefault('THROTTLE_BLOCK_DURATION_MS', 10000),
    download: {
      ttl: withDefault('THROTTLE_DOWNLOAD_TTL_MS', 60000 * 60),
      limit: withDefault('THROTTLE_DOWNLOAD_LIMIT', 60),
      blockDuration: withDefault('THROTTLE_DOWNLOAD_BLOCK_DURATION_MS', 3600000 * 12),
    },
  },

  cors: {
    origin: withDefault('CORS_ORIGIN', '*'),
    methods: process.env.CORS_METHODS?.split(',') || [
      'GET',
      'POST',
      'PUT',
      'DELETE',
      'OPTIONS',
      'PATCH',
    ],
  },

  email: {
    emailProvider: withDefault('EMAIL_PROVIDER', 'elastic'),
    emailApiKey: withDefault('EMAIL_PROVIDER_API_KEY', ''),
    emailEndPoint: withDefault('EMAIL_PROVIDER_ENDPOINT', ''),
    emailSenderAddress: withDefault('EMAIL_SENDER_ADDRESS', ''),
    emailSenderName: withDefault('EMAIL_SENDER_NAME', ''),
  },

  s3: {
    image: {
      bucket: withDefault('S3_IMAGE_BUCKET', ''),
      region: withDefault('S3_IMAGE_REGION', ''),
      endpoint: withDefault('S3_IMAGE_ENDPOINT', ''),
      accessKeyId: withDefault('S3_IMAGE_ACCESS_KEY_ID', ''),
      secretAccessKey: withDefault('S3_IMAGE_SECRET_ACCESS_KEY', ''),
    },
    game: {
      bucket: withDefault('S3_FILE_BUCKET', ''),
      region: withDefault('S3_FILE_REGION', ''),
      endpoint: withDefault('S3_FILE_ENDPOINT', ''),
      accessKeyId: withDefault('S3_FILE_ACCESS_KEY_ID', ''),
      secretAccessKey: withDefault('S3_FILE_SECRET_ACCESS_KEY', ''),
    },
    backup: {
      bucket: withDefault('S3_BACKUP_BUCKET', ''),
      region: withDefault('S3_BACKUP_REGION', ''),
      endpoint: withDefault('S3_BACKUP_ENDPOINT', ''),
      accessKeyId: withDefault('S3_BACKUP_ACCESS_KEY_ID', ''),
      secretAccessKey: withDefault('S3_BACKUP_SECRET_ACCESS_KEY', ''),
    },
  },

  b2: {
    applicationKeyId: withDefault('B2_APPLICATION_KEY_ID', ''),
    applicationKey: withDefault('B2_APPLICATION_KEY', ''),
  },

  bangumi: {
    clientId: withDefault('BANGUMI_CLIENT_ID', ''),
    clientSecret: withDefault('BANGUMI_CLIENT_SECRET', ''),
  },

  file_upload: {
    upload_large_file_transfer_limit: withDefault('UPLOAD_LARGE_FILE_TRANSFER_LIMIT', '100mb'),
    upload_large_file_max_size: withDefault('UPLOAD_LARGE_FILE_MAX_SIZE', 20 * 1024 * 1024 * 1024), // 20GB
    upload_large_file_max_chunks: withDefault('UPLOAD_LARGE_FILE_MAX_CHUNKS', 10000),
    upload_root_dir: withDefault('FILE_UPLOAD_ROOT_DIR', '/tmp/shionlib-upload/'),
    chunk_size: withDefault('FILE_UPLOAD_CHUNK_SIZE', 1024 * 1024 * 50), // 50MB
    upload_session_expires_in: withDefault('FILE_UPLOAD_SESSION_EXPIRES_IN', 1000 * 60 * 60 * 24), // 1 day
    upload_temp_file_suffix: withDefault('FILE_UPLOAD_TEMP_FILE_SUFFIX', '.sltf'), // shionlib temp file
    upload_quota: {
      base_size_bytes: withDefault('UPLOAD_QUOTA_BASE_SIZE_BYTES', 5 * 1024 * 1024 * 1024), // 5GB
      cap_size_bytes: withDefault('UPLOAD_QUOTA_CAP_SIZE_BYTES', 20 * 1024 * 1024 * 1024), // 20GB
      dynamic_step_bytes: withDefault('UPLOAD_QUOTA_DYNAMIC_STEP_BYTES', 2 * 1024 * 1024 * 1024), // 2GB
      dynamic_threshold_bytes: withDefault(
        'UPLOAD_QUOTA_DYNAMIC_THRESHOLD_BYTES',
        2.5 * 1024 * 1024 * 1024,
      ), // 2.5GB
      dynamic_reduce_step_bytes: withDefault(
        'UPLOAD_QUOTA_DYNAMIC_REDUCE_STEP_BYTES',
        1 * 1024 * 1024 * 1024,
      ), // 1GB
      dynamic_reduce_inactive_days: withDefault('UPLOAD_QUOTA_DYNAMIC_REDUCE_INACTIVE_DAYS', 45),
      grant_after_days: withDefault('UPLOAD_QUOTA_GRANT_AFTER_DAYS', 7),
      longest_inactive_days: withDefault('UPLOAD_QUOTA_LONGEST_INACTIVE_DAYS', 120),
    },
  },

  file_scan: {
    clamscan_binary_path: withDefault(
      'CLAMSCAN_BINARY_PATH',
      '/opt/homebrew/opt/clamav/bin/clamscan',
    ),
    clamscan_db_path: withDefault('CLAMSCAN_DB_PATH', '/opt/homebrew/var/lib/clamav'),
    clamscan_scan_log_path: withDefault(
      'CLAMSCAN_SCAN_LOG_PATH',
      '/var/log/shionlib/clamav-scan.log',
    ),
    malware_review_timeout_hours: withDefault('FILE_SCAN_MALWARE_REVIEW_TIMEOUT_HOURS', 24),
    malware_auto_ban_threshold: withDefault('FILE_SCAN_MALWARE_AUTO_BAN_THRESHOLD', 3),
    malware_auto_ban_duration_days: withDefault('FILE_SCAN_MALWARE_AUTO_BAN_DURATION_DAYS', 30),
    malware_auto_delete_review_note: withDefault(
      'FILE_SCAN_MALWARE_AUTO_DELETE_REVIEW_NOTE',
      'Auto delete due to review timeout',
    ),
  },

  file_download: {
    download_cdn_host: withDefault('FILE_DOWNLOAD_CDN_HOST', 'https://ft.hikarifallback.uk/'),
    download_expires_in: withDefault('FILE_DOWNLOAD_EXPIRES_IN', 3600), // 1 hour
  },

  tasks: {
    image_upload: {
      enabled: withDefault('TASKS_IMAGE_UPLOAD_ENABLED', true),
    },
  },

  search: {
    engine: withDefault('SEARCH_ENGINE', 'pg'),
    meilisearch: {
      host: withDefault('MEILISEARCH_HOST', ''),
      apiKey: withDefault('MEILISEARCH_API_KEY', ''),
      indexName: withDefault('MEILISEARCH_INDEX_NAME', 'shionlib_games'),
    },
    opensearch: {
      host: withDefault('OPENSEARCH_HOST', 'localhost'),
      protocol: withDefault('OPENSEARCH_PROTOCOL', 'https'),
      port: withDefault('OPENSEARCH_PORT', 9200),
      auth: withDefault('OPENSEARCH_AUTH', 'admin:admin'), // username:password
      caPath: withDefault('OPENSEARCH_CA_PATH', ''),
      indexName: withDefault('OPENSEARCH_INDEX_NAME', 'shionlib_games'),
    },
  },

  game: {
    hot_score: {
      half_life_release_days: withDefault('GAME_HOT_SCORE_HALF_LIFE_RELEASE_DAYS', 30),
      half_life_created_days: withDefault('GAME_HOT_SCORE_HALF_LIFE_CREATED_DAYS', 15),
      weight_views: withDefault('GAME_HOT_SCORE_WEIGHT_VIEWS', 0.6),
      weight_downloads: withDefault('GAME_HOT_SCORE_WEIGHT_DOWNLOADS', 1.0),
      weight_release: withDefault('GAME_HOT_SCORE_WEIGHT_RELEASE', 0.8),
      weight_created: withDefault('GAME_HOT_SCORE_WEIGHT_CREATED', 0.4),
      recent_window_days: withDefault('GAME_HOT_SCORE_RECENT_WINDOW_DAYS', 7),
      weight_recent_views: withDefault('GAME_HOT_SCORE_WEIGHT_RECENT_VIEWS', 0.6),
      weight_recent_downloads: withDefault('GAME_HOT_SCORE_WEIGHT_RECENT_DOWNLOADS', 0.9),
    },
  },

  cloudflare: {
    analytics: {
      secret: withDefault('CLOUDFLARE_ANALYTICS_SECRET', ''),
      zone_id: withDefault('CLOUDFLARE_ANALYTICS_ZONE_ID', ''),
    },
    turnstile: {
      secret: withDefault('CLOUDFLARE_TURNSTILE_SECRET', ''),
    },
  },
})
