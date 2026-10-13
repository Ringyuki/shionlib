import { AlertDialog, Center, DataList, Empty, Text, Time, toast } from '@hina-ui/react'
import { Fingerprint, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useFormatter, useTranslations } from 'use-intl'
import { IconButton } from '~/shared/ui/button'
import type { Passkey } from '../account'
import { usePasskeyRemoval } from '../use-passkeys'

export function PasskeyList({ passkeys }: { passkeys: readonly Passkey[] }) {
  const t = useTranslations('account.passkey')
  const format = useFormatter()
  const removal = usePasskeyRemoval()
  const [picked, setPicked] = useState<Passkey>()
  const [removing, setRemoving] = useState(false)
  const nameOf = (passkey: Passkey) => (passkey.name ?? '').trim() || t('unnamed')
  return (
    <>
      <DataList
        label={t('title')}
        items={passkeys}
        itemKey="id"
        size="sm"
        minHeight={0}
        renderMedia={() => (
          <Center className="size-full text-muted">
            <Fingerprint aria-hidden className="size-5" />
          </Center>
        )}
        renderTitle={({ item }) => nameOf(item)}
        renderMeta={({ item }) => (
          <>
            <Text as="span" size="xs" tone="muted">
              {t('created', {
                date: format.dateTime(new Date(item.created), { dateStyle: 'medium' }),
              })}
            </Text>
            <Text as="span" size="xs" tone="faint">
              {item.last_used_at === null
                ? t('neverUsed')
                : t.rich('lastUsed', {
                    time: () => <Time value={item.last_used_at ?? ''} format="relative" />,
                  })}
            </Text>
          </>
        )}
        renderActions={({ item }) => (
          <IconButton
            variant="ghost"
            tone="neutral"
            size="sm"
            label={t('remove', { name: nameOf(item) })}
            onClick={() => {
              setPicked(item)
              setRemoving(true)
            }}
          >
            <Trash2 />
          </IconButton>
        )}
        renderEmpty={() => <Empty title={t('empty')} size="sm" />}
      />
      <AlertDialog
        title={t('removeConfirm', { name: picked === undefined ? '' : nameOf(picked) })}
        description={t('removeDescription')}
        confirmText={t('removeAction')}
        cancelText={t('cancel')}
        tone="danger"
        open={removing}
        onOpenChange={setRemoving}
        onConfirm={async () => {
          if (picked !== undefined) {
            await removal.confirm(picked.id)
            toast.success(t('removed'))
          }
        }}
      />
    </>
  )
}
