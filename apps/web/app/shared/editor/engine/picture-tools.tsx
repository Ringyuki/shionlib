import { Card, Divider, Inline } from '@hina-ui/react'
import { Trash2 } from 'lucide-react'
import { useTranslations } from 'use-intl'
import { Button, IconButton } from '~/shared/ui/button'
import { pictureSizes } from '../picture-size'

type PictureToolsProps = {
  percent: number
  widest: number
  onResize: (percent: number) => void
  onRemove: () => void
}

const keep = (event: { preventDefault: () => void }) => event.preventDefault()

export function PictureTools({ percent, widest, onResize, onRemove }: PictureToolsProps) {
  const t = useTranslations('editor')
  const smallest = pictureSizes[0]?.percent ?? widest
  return (
    <Card
      padded={false}
      contentEditable={false}
      className="absolute -top-12 left-1/2 z-10 -translate-x-1/2 p-1 shadow-md"
      onMouseDown={keep}
    >
      <Inline gap="xs" align="center" wrap={false} role="toolbar" aria-label={t('tool.image')}>
        {pictureSizes.map(size => {
          const chosen = Math.min(size.percent, widest) === percent
          return (
            <Button
              key={size.id}
              size="sm"
              variant={chosen ? 'soft' : 'ghost'}
              tone={chosen ? 'accent' : 'neutral'}
              aria-pressed={chosen}
              disabled={size.percent > widest && size.percent !== smallest && !chosen}
              onClick={() => onResize(Math.min(size.percent, widest))}
            >
              {t(`pictureSize.${size.id}`)}
            </Button>
          )
        })}
        <Divider orientation="vertical" className="mx-0.5 h-4 self-center" />
        <IconButton size="sm" tone="danger" label={t('removePicture')} onClick={onRemove}>
          <Trash2 />
        </IconButton>
      </Inline>
    </Card>
  )
}
