import { AlertDialog, Panel, Stack, Text, toast } from '@hina-ui/react'
import { useState } from 'react'
import { useFormatter, useTranslations } from 'use-intl'
import { Button } from '~/shared/ui/button'
import type { PotatoBinding } from '../account'
import { usePotatoUnbinding } from '../use-connections'
import { PotatoDialog } from './potato-dialog'

type Opened = 'bind' | 'unbind' | undefined

export function PotatoPanel({ binding }: { binding: PotatoBinding | null }) {
  const t = useTranslations('account.potato')
  const format = useFormatter()
  const unbinding = usePotatoUnbinding()
  const [opened, setOpened] = useState<Opened>()
  return (
    <Panel
      title={t('title')}
      description={t('hint')}
      actions={
        binding === null ? (
          <Button size="sm" variant="outline" tone="neutral" onClick={() => setOpened('bind')}>
            {t('bind')}
          </Button>
        ) : (
          <Button size="sm" variant="outline" tone="danger" onClick={() => setOpened('unbind')}>
            {t('unbind')}
          </Button>
        )
      }
    >
      {binding !== null && (
        <Stack gap="none">
          <Text truncate>{binding.pvn_user_name}</Text>
          <Text size="xs" tone="muted">
            {t('boundAt', {
              date: format.dateTime(new Date(binding.created), { dateStyle: 'medium' }),
            })}
          </Text>
        </Stack>
      )}
      <PotatoDialog
        open={opened === 'bind'}
        onOpenChange={open => setOpened(open ? 'bind' : undefined)}
      />
      <AlertDialog
        title={t('unbindConfirm')}
        description={t('unbindDescription')}
        confirmText={t('unbind')}
        cancelText={t('cancel')}
        tone="danger"
        open={opened === 'unbind'}
        onOpenChange={open => setOpened(open ? 'unbind' : undefined)}
        onConfirm={async () => {
          await unbinding.confirm()
          toast.success(t('unbound'))
        }}
      />
    </Panel>
  )
}
