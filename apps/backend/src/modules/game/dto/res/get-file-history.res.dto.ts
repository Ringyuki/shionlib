export interface GetFileHistoryResDto {
  id: number
  file_size: number
  hash_algorithm: string
  file_hash: string
  s3_file_key: string | null
  reason: string | null
  operator: {
    id: number
    name: string
    avatar: string | null
  }
  created: Date
}
