export type AdminDownloadResourceReportReason =
  | 'MALWARE'
  | 'IRRELEVANT'
  | 'BROKEN_LINK'
  | 'MISLEADING_CONTENT'
  | 'OTHER'

export type AdminDownloadResourceReportStatus = 'PENDING' | 'VALID' | 'INVALID'

export type AdminReportMaliciousLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export interface AdminDownloadResourceReportUserSummary {
  id: number
  name: string
  avatar: string | null
}

export interface AdminDownloadResourceReportUserDetail
  extends AdminDownloadResourceReportUserSummary {
  role: number
  status: number
}

export interface AdminDownloadResourceReportGameSummary {
  id: number
  title_jp: string | null
  title_zh: string | null
  title_en: string | null
}

export interface AdminDownloadResourceReportFileSummary {
  id: number
  file_name: string
}

export interface AdminDownloadResourceReportFileDetail
  extends AdminDownloadResourceReportFileSummary {
  file_size: number
  file_status: number
  file_check_status: number
  hash_algorithm: string | null
  file_hash: string | null
}

export interface AdminDownloadResourceReportItem {
  id: number
  reason: AdminDownloadResourceReportReason
  detail: string | null
  status: AdminDownloadResourceReportStatus
  malicious_level: AdminReportMaliciousLevel
  processed_at: string | null
  process_note: string | null
  created: string
  updated: string
  resource: {
    id: number
    game_id: number
    game: AdminDownloadResourceReportGameSummary | null
    files: AdminDownloadResourceReportFileSummary[]
  }
  reporter: AdminDownloadResourceReportUserSummary
  reported_user: AdminDownloadResourceReportUserSummary
  processor: AdminDownloadResourceReportUserSummary | null
}

export interface AdminDownloadResourceReportDetail extends AdminDownloadResourceReportItem {
  reporter_penalty_applied: boolean
  reported_penalty_applied: boolean
  resource: {
    id: number
    game_id: number
    note: string | null
    game: AdminDownloadResourceReportGameSummary | null
    files: AdminDownloadResourceReportFileDetail[]
  }
  reporter: AdminDownloadResourceReportUserDetail
  reported_user: AdminDownloadResourceReportUserDetail
}

export interface AdminDownloadResourceReportListQuery {
  page?: number
  limit?: number
  status?: AdminDownloadResourceReportStatus
  reason?: AdminDownloadResourceReportReason
  malicious_level?: AdminReportMaliciousLevel
  resource_id?: number
  reporter_id?: number
  reported_user_id?: number
  sortBy?: 'id' | 'created' | 'updated' | 'processed_at'
  sortOrder?: 'asc' | 'desc'
}

export type AdminDownloadResourceReportVerdict = 'VALID' | 'INVALID'
