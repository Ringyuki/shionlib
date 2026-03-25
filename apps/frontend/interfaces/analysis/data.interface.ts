export interface OverviewData {
  games: number
  files: number
  resources: number
  storage: number
  bytes_gotten: number
}

export interface HourlyTrafficPoint {
  hour: string
  totalBytes: number
  downloadCount: number
}

export interface TopFileTraffic {
  fileId: string
  fileName: string
  totalBytes: number
  downloadCount: number
}

export interface CountryTraffic {
  country: string
  totalBytes: number
  downloadCount: number
}

export interface GameTraffic {
  gameId: number
  gameName: { title_jp: string | null; title_zh: string | null; title_en: string | null }
  totalBytes: number
  downloadCount: number
}

export interface TrafficDetailData {
  totalDownloads: number
  totalBytes: number
  averageSize: number
  prevTotalDownloads: number
  prevTotalBytes: number
  prevAverageSize: number
  hourly: HourlyTrafficPoint[]
  topFiles: TopFileTraffic[]
  countries: CountryTraffic[]
  topGames: GameTraffic[]
}
