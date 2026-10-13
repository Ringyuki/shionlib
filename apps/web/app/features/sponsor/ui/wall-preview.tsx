import { Link, Stack, Switch, Text } from '@hina-ui/react'
import { PencilLine } from 'lucide-react'
import { useTranslations } from 'use-intl'
import type { WallCard } from '../sponsor'
import { SponsorCard } from './sponsor-card'

type WallPreviewProps = {
  shown: boolean
  onShownChange: (shown: boolean) => void
  card: WallCard
  profile: string | undefined
}

export function WallPreview({ shown, onShownChange, card, profile }: WallPreviewProps) {
  const t = useTranslations('sponsor.checkout')
  return (
    <Stack as="section" gap="md">
      <Switch block controlPlacement="end" checked={shown} onCheckedChange={onShownChange}>
        <Text as="span" weight="semibold" className="text-md">
          {t('shown')}
        </Text>
      </Switch>
      {shown && (
        <Stack gap="md" align="center" className="bg-subtle rounded-lg px-4 py-7">
          <SponsorCard card={card} className="w-full max-w-85" />
          {profile !== undefined && (
            <Link
              href={profile}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm"
            >
              <PencilLine aria-hidden className="size-4" />
              {t('editProfile')}
            </Link>
          )}
        </Stack>
      )}
    </Stack>
  )
}
