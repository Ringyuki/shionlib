import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from '@hina-ui/react'
import { Combine, Ellipsis, FilePlus, Flag, History, PencilLine, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslations } from 'use-intl'
import { useAuthGate } from '~/shared/ui/auth-gate'
import { Button } from '~/shared/ui/button'
import type { Resource, ResourceFile, ResourceRights } from '../resource'
import { DeleteDialog } from './delete-dialog'
import { FileDialogs, type FileDialog } from './file-dialogs'
import { FilesItems } from './file-items'
import { HistoryDialog } from './history-dialog'
import { ManageDialogs, type ManageDialog } from './manage-dialogs'
import { ReportDialog } from './report-dialog'

type Opened = 'history' | 'report' | ManageDialog | 'delete' | undefined

type ResourceMenuProps = {
  resource: Resource
  gameId: number
  rights: ResourceRights
  files?: readonly ResourceFile[]
  history?: boolean
  rebuildable?: boolean
  composing?: boolean
}

type Picked = { file: ResourceFile; dialog: FileDialog | undefined }

export function ResourceMenu({
  resource,
  gameId,
  rights,
  files = [],
  history = true,
  rebuildable = false,
  composing = false,
}: ResourceMenuProps) {
  const t = useTranslations('resource')
  const gate = useAuthGate()
  const [opened, setOpened] = useState<Opened>(undefined)
  const [picked, setPicked] = useState<Picked | undefined>(undefined)
  const managed = rights.manage ? files : []
  const pickedFile = managed.find(file => file.id === picked?.file.id) ?? picked?.file ?? managed[0]
  const openWhen = (dialog: Opened) => (open: boolean) => setOpened(open ? dialog : undefined)
  const report = () => {
    if (gate.signedIn) {
      setOpened('report')
      return
    }
    gate.requireSignIn(() => setOpened('report'))
  }
  return (
    <>
      <DropdownMenu
        label={t('actions')}
        align="end"
        content={
          <>
            {history && (
              <DropdownMenuItem icon={<History />} onSelect={() => setOpened('history')}>
                {t('history')}
              </DropdownMenuItem>
            )}
            {rights.manage ? (
              <>
                <DropdownMenuItem icon={<PencilLine />} onSelect={() => setOpened('edit')}>
                  {t('edit')}
                </DropdownMenuItem>
                <FilesItems
                  files={managed}
                  onPick={(file, dialog) => setPicked({ file, dialog })}
                />
                {!composing && (
                  <DropdownMenuItem icon={<FilePlus />} onSelect={() => setOpened('add')}>
                    {t('addFiles')}
                  </DropdownMenuItem>
                )}
                {rebuildable && (
                  <DropdownMenuItem icon={<Combine />} onSelect={() => setOpened('update')}>
                    {t('composition.update.menu')}
                  </DropdownMenuItem>
                )}
              </>
            ) : (
              <DropdownMenuItem icon={<Flag />} onSelect={report}>
                {t('report')}
              </DropdownMenuItem>
            )}
            {rights.remove && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  icon={<Trash2 />}
                  tone="danger"
                  onSelect={() => setOpened('delete')}
                >
                  {t('deleteResource')}
                </DropdownMenuItem>
              </>
            )}
          </>
        }
      >
        <Button
          variant="ghost"
          tone="neutral"
          size="sm"
          iconOnly
          aria-label={t('actions')}
          icon={<Ellipsis />}
        />
      </DropdownMenu>
      <HistoryDialog
        files={resource.files ?? []}
        open={opened === 'history'}
        onOpenChange={openWhen('history')}
      />
      {rights.manage ? (
        <ManageDialogs
          resource={resource}
          gameId={gameId}
          opened={opened}
          onOpenedChange={setOpened}
        />
      ) : (
        <ReportDialog
          resourceId={resource.id}
          open={opened === 'report'}
          onOpenChange={openWhen('report')}
        />
      )}
      {pickedFile !== undefined && (
        <FileDialogs
          file={pickedFile}
          opened={picked?.dialog}
          onOpenedChange={dialog => setPicked({ file: pickedFile, dialog })}
        />
      )}
      {rights.remove && (
        <DeleteDialog
          resourceId={resource.id}
          open={opened === 'delete'}
          onOpenChange={openWhen('delete')}
        />
      )}
    </>
  )
}
