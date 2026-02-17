import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface UploadTuning {
  concurrency: number
  chunkSize: number
}
export interface UploadTuningStore {
  uploadTuning: UploadTuning
  getUploadTuning: () => UploadTuning
  setUploadTuning: (uploadTuning: Partial<UploadTuning>) => void
}
const initialState: UploadTuning = {
  concurrency: 4,
  chunkSize: 1024 * 1024 * 5,
}

export const useUploadTuningStore = create<UploadTuningStore>()(
  persist(
    (set, get) => ({
      uploadTuning: initialState,
      getUploadTuning: () => get().uploadTuning,
      setUploadTuning: (uploadTuning: Partial<UploadTuningStore['uploadTuning']>) => {
        set({ uploadTuning: { ...get().uploadTuning, ...uploadTuning } })
      },
    }),
    {
      name: 'shionlib-upload-tuning-store',
      storage: createJSONStorage(() => localStorage),
    },
  ),
)
