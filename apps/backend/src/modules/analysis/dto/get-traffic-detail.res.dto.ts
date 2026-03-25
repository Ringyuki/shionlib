export class HourlyTrafficPoint {
  hour: string
  totalBytes: number
  downloadCount: number
}

export class TopFileTraffic {
  fileId: string
  fileName: string
  totalBytes: number
  downloadCount: number
}

export class CountryTraffic {
  country: string
  totalBytes: number
  downloadCount: number
}

export class GameTraffic {
  gameId: number
  gameName: { title_jp: string | null; title_zh: string | null; title_en: string | null }
  totalBytes: number
  downloadCount: number
}

export class GetTrafficDetailResDto {
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
