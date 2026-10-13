import {
  Avatar,
  Blockquote,
  Card,
  Image,
  Inline,
  Stack,
  Tag,
  Text,
  useImageResolver,
} from '@hina-ui/react'
import { UserRound } from 'lucide-react'
import { Link } from 'react-router'
import { useFormatter, useLocale, useTranslations } from 'use-intl'
import { profilePath } from '~/features/profile'
import type { WallCard } from '../sponsor'

type SponsorCardProps = {
  card: WallCard
  className?: string
}

const onCover = 'ring-surface -mt-8 size-16 text-2xl ring-3'

export function SponsorCard({ card, className = '' }: SponsorCardProps) {
  const locale = useLocale()
  const linked = card.userId !== undefined
  return (
    <Card
      padded={false}
      className={`overflow-hidden ${linked ? 'hn-interactive' : ''} ${className}`}
    >
      {card.userId === undefined ? (
        <CardFace card={card} />
      ) : (
        <Link to={profilePath(locale, card.userId)} prefetch="intent" className="block">
          <CardFace card={card} />
        </Link>
      )}
    </Card>
  )
}

function CardFace({ card }: { card: WallCard }) {
  const t = useTranslations('sponsor')
  const format = useFormatter()
  const name = card.name ?? t('anonymous')
  const covered = card.cover !== null
  return (
    <Stack gap="none">
      {card.cover !== null && (
        <Image src={card.cover} alt={t('coverOf', { name })} ratio={3} fit="cover" />
      )}
      <Stack gap="sm" className={covered ? 'px-4 pb-4' : 'p-4'}>
        <Inline
          gap="md"
          align="center"
          wrap={false}
          className={covered ? 'flex-col items-start' : ''}
        >
          <Portrait card={card} name={name} className={covered ? onCover : 'size-12 text-lg'} />
          <Inline gap="sm" align="center" className="min-w-0">
            <Text weight="semibold" className="break-all">
              {name}
            </Text>
            {card.active && (
              <Tag size="sm" tone="accent">
                {t('tag')}
              </Tag>
            )}
          </Inline>
        </Inline>
        {card.bio !== '' && (
          <Text size="sm" tone="muted" className="line-clamp-3 break-words whitespace-pre-line">
            {card.bio}
          </Text>
        )}
        {card.message !== '' && (
          <Blockquote className="text-fg line-clamp-5 text-[0.9375rem] break-words whitespace-pre-line">
            {card.message}
          </Blockquote>
        )}
        <Text size="xs" tone="faint">
          {card.at === undefined
            ? t('today')
            : format.dateTime(new Date(card.at), { dateStyle: 'long' })}
        </Text>
      </Stack>
    </Stack>
  )
}

type PortraitProps = {
  card: WallCard
  name: string
  className: string
}

function Portrait({ card, name, className }: PortraitProps) {
  const t = useTranslations('sponsor')
  const resolveImage = useImageResolver()
  return (
    <Avatar
      src={card.avatar === null ? undefined : resolveImage(card.avatar, 'image')}
      name={card.name}
      alt={t('avatarOf', { name })}
      className={`shrink-0 ${className}`}
    >
      {card.name === undefined && <UserRound aria-hidden className="size-1/2" />}
    </Avatar>
  )
}
