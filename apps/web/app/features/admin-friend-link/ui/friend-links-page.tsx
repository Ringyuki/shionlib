import { AlertDialog, Card, PageHeader, Stack, toast } from '@hina-ui/react'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslations } from 'use-intl'
import { Button } from '~/shared/ui/button'
import { useLast } from '~/shared/ui/use-last'
import { inOrder, type Link } from '../admin-friend-link'
import type { Listing } from '../admin-friend-link.use-cases'
import { useLinkChange } from '../use-link-change'
import { LinkDialog, type Editing } from './link-dialog'
import { LinkTable } from './link-table'

export function FriendLinksPage({ links }: Listing) {
  const t = useTranslations('adminFriendLink')
  const shared = useTranslations('admin')
  const change = useLinkChange()
  const [editing, setEditing] = useState<Editing>()
  const [removing, setRemoving] = useState<Link>()
  const removed = useLast(removing)
  const submitted = change.pending ? change.submitted : undefined
  const shown = submitted?.action === 'reorder' ? inOrder(links, submitted.ids) : links
  const busy = submitted !== undefined && 'id' in submitted ? submitted.id : undefined
  const toggle = async (link: Link) => {
    const outcome = await change.run({ action: 'visible', id: link.id, visible: !link.visible })
    if (outcome.ok) {
      toast.success(t(link.visible ? 'hidden' : 'shown'))
    }
  }
  return (
    <Stack gap="lg">
      <PageHeader
        title={t('title')}
        actions={
          <Button icon={<Plus />} onClick={() => setEditing({ link: undefined })}>
            {t('add')}
          </Button>
        }
      />
      <Card padded={false}>
        <LinkTable
          links={shown}
          busy={busy}
          onReorder={
            shown.length > 1 ? ids => void change.run({ action: 'reorder', ids }) : undefined
          }
          onEdit={link => setEditing({ link })}
          onToggle={link => void toggle(link)}
          onRemove={setRemoving}
        />
      </Card>
      <LinkDialog editing={editing} onClose={() => setEditing(undefined)} />
      <AlertDialog
        tone="danger"
        title={t('remove.title', { name: removed?.name ?? '' })}
        description={t('remove.description')}
        confirmText={t('remove.confirm')}
        cancelText={shared('cancel')}
        open={removing !== undefined}
        onOpenChange={open => {
          if (!open) {
            setRemoving(undefined)
          }
        }}
        onConfirm={async () => {
          if (removing !== undefined) {
            await change.confirm({ action: 'remove', id: removing.id })
            toast.success(t('remove.done'))
          }
        }}
      />
    </Stack>
  )
}
