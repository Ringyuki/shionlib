import { GameDownloadResourceReportReason, ReportMaliciousLevel } from '@prisma/client'

export const ONE_GB_BYTES = 1024 * 1024 * 1024
export const FALSE_REPORT_WINDOW_DAYS = 30
export const FALSE_REPORT_SUSPEND_THRESHOLD = 12

export const DEFAULT_LEVEL_BY_REASON: Record<
  GameDownloadResourceReportReason,
  ReportMaliciousLevel
> = {
  MALWARE: ReportMaliciousLevel.CRITICAL,
  IRRELEVANT: ReportMaliciousLevel.MEDIUM,
  BROKEN_LINK: ReportMaliciousLevel.LOW,
  MISLEADING_CONTENT: ReportMaliciousLevel.HIGH,
  OTHER: ReportMaliciousLevel.MEDIUM,
}

export const TARGET_PENALTY_BY_LEVEL: Record<
  ReportMaliciousLevel,
  {
    quotaSubBytes: number
    banDays: number
  }
> = {
  LOW: {
    quotaSubBytes: 0,
    banDays: 0,
  },
  MEDIUM: {
    quotaSubBytes: ONE_GB_BYTES,
    banDays: 0,
  },
  HIGH: {
    quotaSubBytes: ONE_GB_BYTES * 2,
    banDays: 7,
  },
  CRITICAL: {
    quotaSubBytes: ONE_GB_BYTES * 5,
    banDays: 30,
  },
}
