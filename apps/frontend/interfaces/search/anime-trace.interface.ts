export interface AnimeTraceResponse {
  code: number
  data: AnimeTraceData[]
  ai: boolean
  trace_id: string
  zh_message?: string
}

export interface AnimeTraceData {
  box: number[]
  box_id: string
  not_confident: boolean
  character: AnimeTraceCharacter[]
}

export interface AnimeTraceCharacter {
  work: string
  character: string
}
