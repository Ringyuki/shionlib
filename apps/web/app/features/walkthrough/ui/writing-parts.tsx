import { cn, Flex, IconButton, Inline, Stack } from '@hina-ui/react'
import { GripVertical, Plus, WandSparkles } from 'lucide-react'
import { useTranslations } from 'use-intl'
import { Button } from '~/shared/ui/button'
import { Sortable, useSortableRow, type SortSpeech } from '~/shared/ui/sortable'
import { conditioned, portraitsIn, type Face, type Portrait } from '../walkthrough'
import type { RouteDraft } from '../walkthrough-draft'
import { entrySurface, RouteEntry } from './route-entry'

type WritingPartsProps = {
  routes: readonly RouteDraft[]
  faces: readonly Face[]
  shown: string | undefined
  full: boolean
  roomy?: boolean
  onShow: (key: string) => void
  onMove: (key: string, over: string) => void
  onAdd: () => void
  onFormat?: () => void
}

export function WritingParts(props: WritingPartsProps) {
  const { routes, faces, shown, full, roomy = false, onShow, onMove, onAdd, onFormat } = props
  const t = useTranslations('walkthrough')
  const locks = routes.some(route => conditioned(route))
  const name = (key: string) => {
    const route = routes.find(each => each.key === key)
    return route === undefined || route.name.trim() === '' ? t('unnamed') : route.name
  }
  const speech: SortSpeech = {
    instructions: t('sorting.instructions'),
    picked: key => t('sorting.picked', { name: name(key) }),
    moved: (key, position) =>
      t('sorting.moved', { name: name(key), position, count: routes.length }),
    dropped: (key, position) => t('sorting.dropped', { name: name(key), position }),
    cancelled: key => t('sorting.cancelled', { name: name(key) }),
  }
  return (
    <Stack as="nav" gap="none" aria-label={t('routes')} className="gap-0.5">
      <Sortable ids={routes.map(route => route.key)} speech={speech} onMove={onMove}>
        {routes.map(route => (
          <PartRow
            key={route.key}
            route={route}
            portraits={portraitsIn(route, faces)}
            locks={locks}
            active={shown === route.key}
            roomy={roomy}
            onShow={() => onShow(route.key)}
          />
        ))}
      </Sortable>
      <Inline gap="sm" className="mt-2">
        <Button
          variant="outline"
          tone="neutral"
          size={roomy ? 'md' : 'sm'}
          icon={<Plus />}
          disabled={full}
          onClick={onAdd}
        >
          {t('addRoute')}
        </Button>
        {onFormat !== undefined && (
          <Button
            variant="outline"
            tone="neutral"
            size={roomy ? 'md' : 'sm'}
            icon={<WandSparkles />}
            onClick={onFormat}
          >
            {t('format.open')}
          </Button>
        )}
      </Inline>
    </Stack>
  )
}

type PartRowProps = {
  route: RouteDraft
  portraits: readonly Portrait[]
  locks: boolean
  active: boolean
  roomy: boolean
  onShow: () => void
}

function PartRow({ route, portraits, locks, active, roomy, onShow }: PartRowProps) {
  const t = useTranslations('walkthrough')
  const { setRow, setHandle, moving, grip, dragging } = useSortableRow(route.key, t('sorting.role'))
  return (
    <Flex
      ref={setRow}
      style={moving}
      className={entrySurface(active, cn('items-center', dragging && 'bg-surface z-10 shadow-md'))}
    >
      <IconButton
        {...grip}
        ref={setHandle}
        label={t('reorder')}
        tooltip={false}
        variant="ghost"
        tone="neutral"
        size="sm"
        className={cn(
          'h-10 w-7 shrink-0 cursor-grab touch-none',
          active ? 'text-inherit' : 'text-faint',
        )}
      >
        <GripVertical />
      </IconButton>
      <Flex
        as="button"
        aria-current={active ? 'true' : undefined}
        onClick={onShow}
        className={cn(
          'hn-interactive min-w-0 flex-1 items-center gap-3 rounded-lg py-2.5 pe-3 text-start',
          roomy ? 'min-h-12' : 'min-h-11',
        )}
      >
        <RouteEntry
          name={route.name.trim()}
          portraits={portraits}
          active={active}
          conditioned={conditioned(route)}
          locks={locks}
          roomy={roomy}
        />
      </Flex>
    </Flex>
  )
}
