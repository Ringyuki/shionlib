import { Image, Inline, Stack, Tag } from '@hina-ui/react'
import { Pencil, Trash2 } from 'lucide-react'
import { useTranslations } from 'use-intl'
import { PaneSection, ReviewPane } from '~/features/admin'
import { Button } from '~/shared/ui/button'
import { useLast } from '~/shared/ui/use-last'
import { bannerRatio, statusTones, type Range } from '../admin-ad'
import type { Opened } from '../admin-ad.use-cases'
import type { AdActions } from './ad-menu'
import { PaneFacts } from './pane-facts'
import { PaneReport } from './pane-report'

type AdPaneProps = AdActions & {
  opened: Opened | undefined
  days: Range
  pending: boolean
  onClose: () => void
  onDays: (days: Range) => void
}

export function AdPane({
  opened,
  days,
  pending,
  onClose,
  onDays,
  onEdit,
  onToggle,
  onRemove,
}: AdPaneProps) {
  const t = useTranslations('adminAd')
  const shown = useLast(opened)
  return (
    <ReviewPane
      heading={shown?.ad.name ?? ''}
      open={opened !== undefined}
      onClose={onClose}
      renderContent={() =>
        shown === undefined ? null : (
          <Stack gap="xl">
            <Inline gap="sm" align="center">
              <Tag tone={statusTones[shown.ad.status]}>{t(`status.${shown.ad.status}`)}</Tag>
            </Inline>
            {shown.ad.banner !== null && (
              <PaneSection label={t('pane.banner')}>
                <Image
                  src={shown.ad.banner}
                  alt={shown.ad.name}
                  ratio={bannerRatio}
                  className="rounded-lg"
                />
              </PaneSection>
            )}
            {shown.ad.side_image !== null && (
              <PaneSection label={t('pane.side')}>
                <Inline gap="md" align="center" wrap={false}>
                  <Image
                    src={shown.ad.side_image}
                    alt={shown.ad.name}
                    fit="contain"
                    className="h-10 min-w-0 flex-1"
                    imageClass="object-left"
                  />
                  <Image
                    src={shown.ad.side_icon ?? ''}
                    alt=""
                    className="size-7 shrink-0 rounded-md"
                  />
                </Inline>
              </PaneSection>
            )}
            <PaneSection label={t('pane.placement')}>
              <PaneFacts ad={shown.ad} />
            </PaneSection>
            <PaneReport report={shown.report} days={days} onDays={onDays} />
          </Stack>
        )
      }
      renderFooter={() =>
        shown === undefined ? null : (
          <>
            <Button
              variant="outline"
              tone="danger"
              icon={<Trash2 />}
              className="me-auto"
              onClick={() => onRemove(shown.ad)}
            >
              {t('menu.remove')}
            </Button>
            <Button
              variant="outline"
              tone="neutral"
              loading={pending}
              onClick={() => onToggle(shown.ad)}
            >
              {t(shown.ad.enabled ? 'menu.disable' : 'menu.enable')}
            </Button>
            <Button icon={<Pencil />} onClick={() => onEdit(shown.ad)}>
              {t('menu.edit')}
            </Button>
          </>
        )
      }
    />
  )
}
