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

/** Payload for PATCH /galgame (create or update). Mirrors GalgameUpdateDto. */
export interface PvnGalgameUpdatePayload {
  id?: number
  bgmId?: string | null
  vndbId?: string | null
  name?: string
  cnName?: string
  description?: string
  tags?: string[]
  releasedDateTimeStamp?: number | null
  playType?: number
  myRate?: number
  comment?: string
  headerImageOssLoc?: string
  headerImageExternalUrl?: string
  imageLoc?: string
  imageUrl?: string
  playCount?: number
}

export interface PvnGalgameListResponse {
  cnt: number
  pageCnt: number
  pageIndex: number
  pageSize: number
  items: PvnGalgame[]
}
