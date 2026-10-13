import type { Resource } from '../resource'
import { AddFilesDialog } from './add-files-dialog'
import { EditDialog } from './edit-dialog'
import { UpdatePatchDialog } from './update-patch-dialog'

export type ManageDialog = 'edit' | 'add' | 'update'

type ManageDialogsProps = {
  resource: Resource
  gameId: number
  opened: string | undefined
  onOpenedChange: (opened: ManageDialog | undefined) => void
}

export function ManageDialogs({ resource, gameId, opened, onOpenedChange }: ManageDialogsProps) {
  const openWhen = (dialog: ManageDialog) => (open: boolean) =>
    onOpenedChange(open ? dialog : undefined)
  return (
    <>
      <EditDialog
        resource={resource}
        game={gameId}
        open={opened === 'edit'}
        onOpenChange={openWhen('edit')}
      />
      <AddFilesDialog resource={resource} open={opened === 'add'} onOpenChange={openWhen('add')} />
      <UpdatePatchDialog
        resource={resource}
        open={opened === 'update'}
        onOpenChange={openWhen('update')}
      />
    </>
  )
}
