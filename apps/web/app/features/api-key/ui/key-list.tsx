import {
  AlertDialog,
  Center,
  DataList,
  Empty,
  Inline,
  Tag,
  Text,
  Time,
  toast,
} from '@hina-ui/react'
import { KeyRound, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useFormatter, useTranslations } from 'use-intl'
import { IconButton } from '~/shared/ui/button'
import { useLast } from '~/shared/ui/use-last'
import type { Key } from '../api-key'
import { useKeyChange } from '../use-key-change'

export function KeyList({ keys }: { keys: readonly Key[] }) {
  const t = useTranslations('apiKey')
  const format = useFormatter()
  const removal = useKeyChange()
  const [removing, setRemoving] = useState<Key>()
  const removed = useLast(removing)
  const day = (value: string) => format.dateTime(new Date(value), { dateStyle: 'medium' })
  return (
    <>
      <DataList
        label={t('title')}
        items={keys}
        itemKey="id"
        size="sm"
        minHeight={0}
        renderMedia={() => (
          <Center className="text-muted size-full">
            <KeyRound aria-hidden className="size-5" />
          </Center>
        )}
        renderTitle={({ item }) => (
          <Inline gap="sm" align="center">
            {item.name}
            {item.status === 'suspended' && (
              <Tag tone="warning" size="sm">
                {t('suspended')}
              </Tag>
            )}
          </Inline>
        )}
        renderDescription={({ item }) =>
          item.status === 'suspended' && item.suspended_at !== null ? (
            <Text as="span" size="xs" tone="warning">
              {t('suspendedReason', {
                date: day(item.suspended_at),
                reason: item.suspended_reason ?? '',
              })}
            </Text>
          ) : undefined
        }
        renderMeta={({ item }) => (
          <>
            <Text as="span" size="xs" className="font-mono">
              {item.prefix}…
            </Text>
            <Text as="span" size="xs" tone="muted">
              {t('created', { date: day(item.created) })}
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
            label={t('remove', { name: item.name })}
            onClick={() => setRemoving(item)}
          >
            <Trash2 />
          </IconButton>
        )}
        renderEmpty={() => <Empty title={t('empty')} size="sm" />}
      />
      <AlertDialog
        title={t('removeConfirm', { name: removed?.name ?? '' })}
        description={t('removeDescription')}
        confirmText={t('removeAction')}
        cancelText={t('cancel')}
        tone="danger"
        open={removing !== undefined}
        onOpenChange={open => {
          if (!open) {
            setRemoving(undefined)
          }
        }}
        onConfirm={async () => {
          if (removing !== undefined) {
            await removal.confirm({ action: 'remove', id: removing.id })
            toast.success(t('removed'))
          }
        }}
      />
    </>
  )
}
