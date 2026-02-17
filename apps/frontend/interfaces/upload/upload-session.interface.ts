export interface UploadSession {
  upload_session_id: number
  file_name?: string
  uploaded_chunks?: number[]
  chunk_size?: number
  total_size?: number
  file_sha256?: string
  total_chunks: number
  expires_at: Date
}
