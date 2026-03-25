export interface CloudflareGraphQLError {
  message: string
  path?: Array<string | number> | null
  extensions?: Record<string, unknown>
}

export interface CloudflareGraphQLResponse<TData> {
  data?: TData
  errors?: CloudflareGraphQLError[] | null
}

export interface CloudflareHttpRequestsAdaptiveGroup {
  dimensions: {
    datetimeHour: string
  }
  count: number
  sum: {
    visits: number
    edgeResponseBytes: number
  }
}

export interface CloudflareZoneAnalytics {
  httpRequestsAdaptiveGroups: CloudflareHttpRequestsAdaptiveGroup[]
}

export interface CloudflareAnalyticsData {
  viewer: {
    zones: CloudflareZoneAnalytics[]
  }
}

export interface CloudflareAnalyticsSummary {
  totalRequests: number
  totalVisits: number
  totalEdgeResponseBytes: number
}

export type CloudflareAnalyticsResult = CloudflareAnalyticsData & {
  summary: CloudflareAnalyticsSummary
}

export interface AnalyticsEngineSqlResponse {
  data: Array<{ totalBytes: number }>
  meta: Array<{ name: string; type: string }>
  rows: number
  rows_before_limit_at_least: number
}

export interface AnalyticsEngineSqlGenericResponse<T = Record<string, unknown>> {
  data: T[]
  meta: Array<{ name: string; type: string }>
  rows: number
  rows_before_limit_at_least: number
}
