import { Card, Image, Inline, Stack, Tag, Text, Time } from '@hina-ui/react'
import { Download, FileArchive } from 'lucide-react'
import { Link } from 'react-router'
import { useLocale, useMessages, useTranslations } from 'use-intl'
import { gameTitle, PlatformTag, primaryCover } from '~/features/game'
import { labelOf } from '~/shared/i18n/labels'
import { otherFiles, uploadPath, type Upload } from '../profile'

export function UploadCard({ upload }: { upload: Upload }) {
  const t = useTranslations('profile.uploads')
  const labels = useMessages().game
  const locale = useLocale()
  const others = otherFiles(upload)
  return (
    <Card padded={false} className="hn-interactive h-full overflow-hidden">
      <Link to={uploadPath(locale, upload)} prefetch="intent" className="block h-full p-3">
        <Inline gap="md" align="start" wrap={false} className="h-full">
          <Image
            src={primaryCover(upload.game)?.url}
            alt=""
            ratio={3 / 4}
            fit="cover"
            className="w-18.75 shrink-0 rounded-md"
          />
          <Stack gap="xs" justify="between" className="h-full min-w-0 flex-1">
            <Stack gap="xs" className="min-w-0">
              <Text weight="medium" className="line-clamp-2">
                {gameTitle(upload.game, locale)}
              </Text>
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
              <Inline gap="xs" align="center" wrap={false} className="min-w-0">
                <FileArchive aria-hidden className="size-3.5 shrink-0 text-muted" />
                <Text size="sm" tone="muted" truncate>
                  {upload.file_name}
                </Text>
                {others > 0 && (
                  <Text size="sm" tone="faint" className="shrink-0">
                    {t('otherFiles', { count: others })}
                  </Text>
                )}
              </Inline>
            </Stack>
            <Inline gap="md" align="center" justify="between" wrap={false}>
              <Inline gap="xs" align="center" wrap={false}>
                <Download aria-hidden className="size-3.5 shrink-0 text-muted" />
                <Text size="xs" tone="muted" className="tabular-nums">
                  {t('downloads', { count: upload.downloads })}
                </Text>
              </Inline>
              <Text size="xs" tone="faint" className="shrink-0">
                {t.rich('updated', {
                  time: () => <Time value={upload.updated} format="relative" />,
                })}
              </Text>
            </Inline>
          </Stack>
        </Inline>
      </Link>
    </Card>
  )
}
