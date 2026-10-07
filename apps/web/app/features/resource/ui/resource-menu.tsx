import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from '@hina-ui/react'
import { Ellipsis, FilePlus, Flag, History, PencilLine, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslations } from 'use-intl'
import { useAuthGate } from '~/shared/ui/auth-gate'
import { Button } from '~/shared/ui/button'
import type { Resource, ResourceRights } from '../resource'
import { AddFilesDialog } from './add-files-dialog'
import { DeleteDialog } from './delete-dialog'
import { EditDialog } from './edit-dialog'
import { HistoryDialog } from './history-dialog'
import { ReportDialog } from './report-dialog'

type Opened = 'history' | 'report' | 'edit' | 'add' | 'delete' | undefined

type ResourceMenuProps = {
  resource: Resource
  rights: ResourceRights
}

export function ResourceMenu({ resource, rights }: ResourceMenuProps) {
  const t = useTranslations('resource')
  const gate = useAuthGate()
  const [opened, setOpened] = useState<Opened>(undefined)
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
            <DropdownMenuItem icon={<History />} onSelect={() => setOpened('history')}>
              {t('history')}
            </DropdownMenuItem>
            {rights.manage ? (
              <>
                <DropdownMenuItem icon={<PencilLine />} onSelect={() => setOpened('edit')}>
                  {t('edit')}
                </DropdownMenuItem>
                <DropdownMenuItem icon={<FilePlus />} onSelect={() => setOpened('add')}>
                  {t('addFiles')}
                </DropdownMenuItem>
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
                  {t('delete')}
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
        <>
          <EditDialog
            resource={resource}
            open={opened === 'edit'}
            onOpenChange={openWhen('edit')}
          />
          <AddFilesDialog
            resource={resource}
            open={opened === 'add'}
            onOpenChange={openWhen('add')}
          />
        </>
      ) : (
        <ReportDialog
          resourceId={resource.id}
          open={opened === 'report'}
          onOpenChange={openWhen('report')}
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
