import type { SupportedLocale } from '@/config'
import type { DeveloperOgData } from '@/utils/preferred-content'
import { OG_LAYOUT_MAIN_H, OgLayout } from './shared/og-layout'
import { getLocaleFontFamily } from './shared/locale-font'

const GAP = 48

interface DeveloperOgTemplateProps extends DeveloperOgData {
  locale: SupportedLocale
}

export function DeveloperOgTemplate({ name, intro, logoUrl, locale }: DeveloperOgTemplateProps) {
  const logoSize = OG_LAYOUT_MAIN_H
  const textFontFamily = getLocaleFontFamily(locale)

  return (
    <OgLayout>
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          gap: GAP,
          alignItems: 'center',
          width: '100%',
          height: '100%',
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        {logoUrl ? (
          <div
            style={{
              display: 'flex',
              width: logoSize,
              height: logoSize,
              flexShrink: 0,
              borderRadius: 20,
              overflow: 'hidden',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              background: 'rgba(255,255,255,0.08)',
            }}
          >
            <img
              src={logoUrl}
              width={logoSize}
              height={logoSize}
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
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
              fontSize: 64,
              fontWeight: 700,
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
