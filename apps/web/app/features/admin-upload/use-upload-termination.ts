import { href, useFetcher } from 'react-router'
import { useCommand } from '~/shared/route/use-command'
import type { uploadTerminationAction } from './admin-upload.server'

export function useUploadTermination() {
  return useCommand(useFetcher<typeof uploadTerminationAction>(), href('/resources/admin/uploads'))
}
