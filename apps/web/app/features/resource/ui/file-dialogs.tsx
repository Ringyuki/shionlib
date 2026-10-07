import type { ResourceFile } from '../resource'
import { RemoveFileDialog } from './remove-file-dialog'
import { RenameFileDialog } from './rename-file-dialog'
import { ReplaceFileDialog } from './replace-file-dialog'

export type FileDialog = 'replace' | 'rename' | 'remove'

type FileDialogsProps = {
  file: ResourceFile
  opened: FileDialog | undefined
  onOpenedChange: (opened: FileDialog | undefined) => void
}

export function FileDialogs({ file, opened, onOpenedChange }: FileDialogsProps) {
  const openWhen = (dialog: FileDialog) => (open: boolean) =>
    onOpenedChange(open ? dialog : undefined)
  return (
    <>
      <ReplaceFileDialog
        file={file}
        open={opened === 'replace'}
        onOpenChange={openWhen('replace')}
      />
      <RenameFileDialog file={file} open={opened === 'rename'} onOpenChange={openWhen('rename')} />
      <RemoveFileDialog file={file} open={opened === 'remove'} onOpenChange={openWhen('remove')} />
    </>
  )
}
