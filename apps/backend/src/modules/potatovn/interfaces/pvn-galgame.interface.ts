export interface PvnPlayTime {
  dateTimeStamp: number
  minute: number
}

export interface PvnGalgame {
  id: number
  bgmId: string | null
  vndbId: string | null
  name: string
  cnName: string
  description: string
  imageUrl: string | null
  headerImageUrl: string | null
  tags: string[]
  releasedDateTimeStamp: number | null
  totalPlayTime: number
  playTime: PvnPlayTime[]
  playType: number
  myRate: number
}

export interface PvnGalgameListResponse {
  cnt: number
  pageCnt: number
  pageIndex: number
  pageSize: number
  items: PvnGalgame[]
}
