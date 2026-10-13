import { DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub } from '@hina-ui/react'
import { FileArchive, FileUp, TextCursorInput, Trash2 } from 'lucide-react'
import { useTranslations } from 'use-intl'
import { stored, type ResourceFile } from '../resource'
import type { FileDialog } from './file-dialogs'

type FileItemsProps = {
  file: ResourceFile
  removable: boolean
  named?: boolean
  onPick: (dialog: FileDialog) => void
}

export function FileItems({ file, removable, named = false, onPick }: FileItemsProps) {
  const t = useTranslations('resource')
  return (
    <>
      {stored(file) && (
        <DropdownMenuItem icon={<FileUp />} onSelect={() => onPick('replace')}>
          {t('replaceFile')}
        </DropdownMenuItem>
      )}
      {!file.canonical_name && (
        <DropdownMenuItem icon={<TextCursorInput />} onSelect={() => onPick('rename')}>
          {t(named ? 'renameFileTitle' : 'renameFile')}
        </DropdownMenuItem>
      )}
      {removable && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem icon={<Trash2 />} tone="danger" onSelect={() => onPick('remove')}>
            {t('removeFile')}
          </DropdownMenuItem>
        </>
      )}
    </>
  )
}

type FilesItemsProps = {
  files: readonly ResourceFile[]
  onPick: (file: ResourceFile, dialog: FileDialog) => void
}

export function FilesItems({ files, onPick }: FilesItemsProps) {
  const [sole] = files
  if (sole === undefined) {
    return null
  }
  if (files.length === 1) {
    return <FileItems file={sole} removable={false} named onPick={dialog => onPick(sole, dialog)} />
  }
  return (
    <>
      <DropdownMenuSeparator />
      {files.map(file => (
        <DropdownMenuSub key={file.id} label={file.file_name} icon={<FileArchive />}>
          <FileItems file={file} removable onPick={dialog => onPick(file, dialog)} />
        </DropdownMenuSub>
      ))}
      <DropdownMenuSeparator />
    </>
  )
}
