import { AlertDialog, DropdownMenu, DropdownMenuItem, Inline, toast } from '@hina-ui/react'
import { Ellipsis, PencilLine, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router'
import { useLocale, useTranslations } from 'use-intl'
import { Button, IconButton } from '~/shared/ui/button'
import { useWalkthroughRemoval } from '../use-walkthrough-removal'
import { walkthroughsPath, writingPath } from '../walkthrough'

type WalkthroughOwnerActionsProps = { gameId: number; walkthroughId: number }

export function WalkthroughOwnerActions({ gameId, walkthroughId }: WalkthroughOwnerActionsProps) {
  const t = useTranslations('walkthrough')
  const locale = useLocale()
  const navigate = useNavigate()
  const removal = useWalkthroughRemoval()
  const [removing, setRemoving] = useState(false)
  return (
    <Inline gap="sm" align="center" wrap={false} className="shrink-0">
      <Button asChild size="sm" variant="outline" tone="neutral">
        <RouterLink to={writingPath(locale, gameId, walkthroughId)}>
          <PencilLine aria-hidden />
          {t('edit')}
        </RouterLink>
      </Button>
      <DropdownMenu
        label={t('more')}
        align="end"
        content={
          <DropdownMenuItem icon={<Trash2 />} tone="danger" onSelect={() => setRemoving(true)}>
            {t('remove')}
          </DropdownMenuItem>
        }
      >
        <IconButton size="sm" label={t('more')} tooltip={false}>
          <Ellipsis />
        </IconButton>
      </DropdownMenu>
      <AlertDialog
        title={t('removeConfirm')}
        description={t('removeDescription')}
        confirmText={t('remove')}
        cancelText={t('cancel')}
        tone="danger"
        open={removing}
        onOpenChange={setRemoving}
        onConfirm={async () => {
          await removal.confirm({ walkthroughId })
          toast.success(t('removed'))
          void navigate(walkthroughsPath(locale, gameId))
        }}
      />
    </Inline>
  )
}
