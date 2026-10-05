import { DropdownMenu, DropdownMenuItem } from '@hina-ui/react'
import { Ellipsis, Flag, PencilLine, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslations } from 'use-intl'
import { useAuthGate } from '~/shared/ui/auth-gate'
import { Button } from '~/shared/ui/button'
import type { Resource } from '../resource'
import { DeleteDialog } from './delete-dialog'
import { EditDialog } from './edit-dialog'
import { ReportDialog } from './report-dialog'

type Opened = 'report' | 'edit' | 'delete' | undefined

export function ResourceMenu({ resource, owned }: { resource: Resource; owned: boolean }) {
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
          owned ? (
            <>
              <DropdownMenuItem icon={<PencilLine />} onSelect={() => setOpened('edit')}>
                {t('edit')}
              </DropdownMenuItem>
              <DropdownMenuItem
                icon={<Trash2 />}
                tone="danger"
                onSelect={() => setOpened('delete')}
              >
                {t('delete')}
              </DropdownMenuItem>
            </>
          ) : (
            <DropdownMenuItem icon={<Flag />} onSelect={report}>
              {t('report')}
            </DropdownMenuItem>
          )
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
      {owned ? (
        <>
          <EditDialog
            resource={resource}
            open={opened === 'edit'}
            onOpenChange={openWhen('edit')}
          />
          <DeleteDialog
            resourceId={resource.id}
            open={opened === 'delete'}
            onOpenChange={openWhen('delete')}
          />
        </>
      ) : (
        <ReportDialog
          resourceId={resource.id}
          open={opened === 'report'}
          onOpenChange={openWhen('report')}
        />
      )}
    </>
  )
}
