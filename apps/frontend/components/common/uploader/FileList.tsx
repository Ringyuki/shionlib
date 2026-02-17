import {
  FileUploadItem,
  FileUploadItemPreview,
  FileUploadItemMetadata,
  FileUploadItemDelete,
  useFileUpload as useFileUploadStore,
} from '@/components/shionui/FileUpload'
import { Phase } from '@/libs/uploader/types'
import { Button } from '@/components/shionui/Button'
import { Trash2 } from 'lucide-react'
import * as React from 'react'

interface FileListProps {
  phase: Phase
}

export const FileList = ({ phase }: FileListProps) => {
  const filesMap = useFileUploadStore(state => state.files)
  const items = React.useMemo(() => Array.from(filesMap.values()), [filesMap])
  return items.map(s => (
    <FileUploadItem key={`${s.file.name}_${s.file.size}_${s.file.lastModified}`} value={s.file}>
      <FileUploadItemPreview />
      <FileUploadItemMetadata />
      <FileUploadItemDelete disabled={phase !== 'idle'} asChild>
        <Button
          appearance="soft"
          intent="destructive"
          size="icon"
          disabled={phase !== 'idle'}
          renderIcon={<Trash2 className="size-4" />}
        />
      </FileUploadItemDelete>
    </FileUploadItem>
  ))
}
