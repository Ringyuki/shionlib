export interface AppConfig {
  port: number
  environment: string
  siteUrl: string
  allowRegister: boolean
  throttle: {
    ttl: number
    limit: number
    blockDuration: number
    download: {
      limit: number
      ttl: number
      blockDuration: number
    }
  }
  cors: {
    origin: string
    methods: string[]
  }
  email: {
    emailProvider: string
    emailApiKey: string
    emailEndPoint: string
    emailSenderAddress: string
    emailSenderName: string
  }
  s3: {
    image: {
      bucket: string
      region: string
      endpoint: string
      accessKeyId: string
      secretAccessKey: string
    }
    game: {
      bucket: string
      region: string
      endpoint: string
      accessKeyId: string
      secretAccessKey: string
    }
    backup: {
      bucket: string
      region: string
      endpoint: string
      accessKeyId: string
      secretAccessKey: string
    }
  }
  b2: {
    applicationKeyId: string
    applicationKey: string
  }
  bangumi: {
    clientId: string
    clientSecret: string
  }
  file_upload: {
    upload_large_file_transfer_limit: string
    upload_large_file_max_size: number
    upload_large_file_max_chunks: number
    upload_root_dir: string
    chunk_size: number
    upload_session_expires_in: number
    upload_temp_file_suffix: string
    upload_quota: {
      base_size_bytes: number
      cap_size_bytes: number
      dynamic_step_bytes: number
      dynamic_threshold_bytes: number
      dynamic_reduce_step_bytes: number
      dynamic_reduce_inactive_days: number
      grant_after_days: number
      longest_inactive_days: number
    }
  }
  file_scan: {
    clamscan_binary_path: string
    clamscan_db_path: string
    clamscan_scan_log_path: string
    malware_review_timeout_hours: number
    malware_auto_ban_threshold: number
    malware_auto_ban_duration_days: number
    malware_auto_delete_review_note: string
  }
  file_download: {
    download_cdn_host: string
    download_expires_in: number
  }
  tasks: {
    image_upload: {
      enabled: boolean
    }
  }
  search: {
    engine: 'pg' | 'meilisearch' | 'opensearch'
    meilisearch: {
      host: string
      apiKey: string
      indexName: string
    }
    opensearch: {
      host: string
      protocol: string
      port: number
      auth: string
      caPath: string
      indexName: string
    }
  }

  game: {
    hot_score: {
      half_life_release_days: number
      half_life_created_days: number
      weight_views: number
      weight_downloads: number
      weight_release: number
      weight_created: number
      recent_window_days: number
      weight_recent_views: number
      weight_recent_downloads: number
    }
  }

  cloudflare: {
    analytics: {
      secret: string
      zone_id: string
    }
    turnstile: {
      secret: string
    }
  }
}
