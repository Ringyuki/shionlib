import type { SupportedLocale } from '@/config'
import type { GameOgData } from '@/utils/preferred-content'
import { OG_LAYOUT_MAIN_H, OgLayout } from './shared/og-layout'
import { getLocaleFontFamily } from './shared/locale-font'

const COVER: Record<GameOgData['aspectRatio'], { w: number; h: number }> = {
  '3:2': { w: 500, h: 333 },
  '2:3': { w: 222, h: 333 },
  '1:1': { w: 280, h: 280 },
}

const GAP = 48

interface GameOgTemplateProps extends GameOgData {
  locale: SupportedLocale
}

export function GameOgTemplate({
  title,
  intro,
  coverUrl,
  aspectRatio,
  locale,
}: GameOgTemplateProps) {
  const cover = COVER[aspectRatio]
  const coverH = OG_LAYOUT_MAIN_H
  const coverW = Math.round((cover.w / cover.h) * coverH)
  const textFontFamily = getLocaleFontFamily(locale)

  return (
    <OgLayout>
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          gap: coverUrl ? GAP : 0,
          alignItems: aspectRatio === '3:2' ? 'center' : 'flex-start',
          width: '100%',
          height: '100%',
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            flex: 1,
            minWidth: 0,
            height: '100%',
            minHeight: 0,
          }}
        >
          <div
            style={{
              fontSize: coverUrl ? 52 : 72,
              fontWeight: 600,
              fontFamily: textFontFamily,
              color: '#f9fafb',
              textShadow: '0 2px 12px rgba(0,0,0,0.4)',
              textOverflow: 'ellipsis',
              overflow: 'hidden',
              lineClamp: 2,
              wordBreak: 'break-word',
              flexShrink: 0,
            }}
          >
            {title}
          </div>

          {intro ? (
            <div
              style={{
                fontSize: 32,
                lineHeight: 1.5,
                color: '#d1d5db',
                fontFamily: textFontFamily,
                textOverflow: 'ellipsis',
                overflow: 'hidden',
                wordBreak: 'break-word',
                flex: 1,
                minHeight: 0,
              }}
            >
              {intro}
            </div>
          ) : null}
        </div>

        {coverUrl ? (
          <div
            style={{
              display: 'flex',
              width: coverW,
              height: coverH,
              flexShrink: 0,
              borderRadius: 16,
              overflow: 'hidden',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              background: 'rgba(255,255,255,0.04)',
            }}
          >
            <img
              src={coverUrl}
              width={coverW}
              height={coverH}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
        ) : null}
      </div>
    </OgLayout>
  )
}
