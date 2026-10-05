import { Inline } from '@hina-ui/react'
import { useState } from 'react'
import { useTranslations } from 'use-intl'
import { Button } from '~/shared/ui/button'
import type { Resource } from '../resource'
import { DeleteDialog } from './delete-dialog'
import { EditDialog } from './edit-dialog'
import { HistoryDialog } from './history-dialog'
import { ReportDialog } from './report-dialog'

type Opened = 'history' | 'report' | 'edit' | 'delete' | undefined

export function ResourceActions({ resource, owned }: { resource: Resource; owned: boolean }) {
  const t = useTranslations('resource')
  const [opened, setOpened] = useState<Opened>(undefined)
  const openWhen = (dialog: Opened) => (open: boolean) => setOpened(open ? dialog : undefined)
  const action = (dialog: Opened, label: string, loginRequired = false) => (
    <Button
      variant="ghost"
      tone={dialog === 'delete' ? 'danger' : 'neutral'}
      size="sm"
      loginRequired={loginRequired}
      onClick={() => setOpened(dialog)}
    >
      {label}
    </Button>
  )
  return (
    <Inline gap="xs" justify="end">
      {action('history', t('history'))}
      {owned ? (
        <>
          {action('edit', t('edit'))}
          {action('delete', t('delete'))}
        </>
      ) : (
        action('report', t('report'), true)
      )}
      <HistoryDialog
        files={resource.files ?? []}
        open={opened === 'history'}
        onOpenChange={openWhen('history')}
      />
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
    </Inline>
  )
}
