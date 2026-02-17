import { GameDownloadResourceReportReason, ReportMaliciousLevel } from '@prisma/client'

export interface EmailConfig {
  provider: 'elastic' | 'postal'
  apiKey: string
  endPoint: string
  senderAddress: string
  senderName: string
}

export interface VerificationCodeData {
  email: string
  code: string
  type: string
  createdAt: number
}

export interface ReportNotificationData {
  reportId: number
  reporterName: string
  reportedUserName: string
  reason: GameDownloadResourceReportReason
  maliciousLevel: ReportMaliciousLevel
  gameTitle: string
  detail?: string
  adminReviewUrl: string
}

export interface MalwareScanNotificationData {
  caseId: number
  fileName: string
  uploaderName: string
  gameTitle: string
  detectedViruses: string[]
  reviewDeadline: Date
  adminReviewUrl: string
}
