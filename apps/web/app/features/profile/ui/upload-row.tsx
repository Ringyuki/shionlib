import { cn, Image, Inline, Stack, Tag, Text } from '@hina-ui/react'
import { Link } from 'react-router'
import { useFormatter, useLocale, useMessages, useTranslations } from 'use-intl'
import { gameTitle, PlatformTag, primaryCover } from '~/features/game'
import { labelOf } from '~/shared/i18n/labels'
import { entryLink } from '~/shared/ui/entry-link'
import { otherFiles, uploadPath, type Upload } from '../profile'

export function UploadRow({ upload }: { upload: Upload }) {
  const t = useTranslations('profile.uploads')
  const labels = useMessages().game
  const locale = useLocale()
  const format = useFormatter()
  const others = otherFiles(upload)
  return (
    <Link
      to={uploadPath(locale, upload)}
      prefetch="intent"
      className={cn(entryLink, 'flex gap-4 p-3')}
    >
      <Image
        src={primaryCover(upload.game)?.url}
        alt=""
        ratio={3 / 4}
        fit="cover"
        className="w-13.5 shrink-0 rounded-md md:w-15"
      />
      <Stack gap="xs" className="min-w-0 flex-1">
        <Text weight="medium" className="break-words">
          {gameTitle(upload.game, locale)}
        </Text>
        <Inline gap="sm" align="center" wrap={false} className="min-w-0">
          <Text size="sm" tone="muted" truncate>
            {upload.file_name}
          </Text>
          {others > 0 && (
            <Text size="sm" tone="faint" className="shrink-0">
              {t('otherFiles', { count: others })}
            </Text>
          )}
        </Inline>
        <Inline align="center" className="mt-0.5 gap-x-3.5 gap-y-1.5">
          <Inline gap="xs" align="center">
            {(upload.platform ?? []).map(platform => (
              <PlatformTag key={platform} platform={platform} />
            ))}
            {(upload.language ?? []).map(language => (
              <Tag key={language} size="sm" variant="outline">
                {labelOf(labels.language, language)}
              </Tag>
            ))}
          </Inline>
          <Inline align="center" className="gap-x-3.5">
            <Text size="xs" tone="faint" className="tabular-nums">
              {t('downloads', { count: upload.downloads })}
            </Text>
            <Text size="xs" tone="faint">
              {format.dateTime(new Date(upload.published_at ?? upload.created), {
                dateStyle: 'long',
              })}
            </Text>
          </Inline>
        </Inline>
      </Stack>
    </Link>
  )
}
