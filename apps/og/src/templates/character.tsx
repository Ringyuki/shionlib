import type { SupportedLocale } from '@/config'
import type { CharacterOgData } from '@/utils/preferred-content'
import { OG_LAYOUT_MAIN_H, OgLayout } from './shared/og-layout'
import { getLocaleFontFamily } from './shared/locale-font'

// Character portraits are always 2:3
const PORTRAIT_W = 222
const PORTRAIT_H = 333
const GAP = 48

interface CharacterOgTemplateProps extends CharacterOgData {
  locale: SupportedLocale
}

export function CharacterOgTemplate({ name, intro, imageUrl, locale }: CharacterOgTemplateProps) {
  const portraitH = OG_LAYOUT_MAIN_H
  const portraitW = Math.round((PORTRAIT_W / PORTRAIT_H) * portraitH)
  const textFontFamily = getLocaleFontFamily(locale)

  return (
    <OgLayout>
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          gap: GAP,
          alignItems: 'flex-start',
          width: '100%',
          height: '100%',
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        {imageUrl ? (
          <div
            style={{
              display: 'flex',
              width: portraitW,
              height: portraitH,
              flexShrink: 0,
              borderRadius: 12,
              overflow: 'hidden',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              background: 'rgba(255,255,255,0.04)',
            }}
          >
            <img
              src={imageUrl}
              width={portraitW}
              height={portraitH}
              style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }}
            />
          </div>
        ) : null}

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
            flex: 1,
            minWidth: 0,
            height: '100%',
            minHeight: 0,
          }}
        >
          <div
            style={{
              fontSize: 60,
              fontWeight: 700,
              fontFamily: textFontFamily,
              color: '#f9fafb',
              textShadow: '0 2px 12px rgba(0,0,0,0.4)',
              textOverflow: 'ellipsis',
              overflow: 'hidden',
              wordBreak: 'break-word',
              flexShrink: 0,
            }}
          >
            {name}
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
      </div>
    </OgLayout>
  )
}
