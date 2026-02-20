import type { SupportedLocale } from '@/config'
import { FALLBACK_IMAGE_KEY } from '@/services/renderer'
import { OG_LAYOUT_MAIN_H, OgLayout } from './shared/og-layout'
import { getLocaleFontFamily } from './shared/locale-font'

const DEFAULT_TITLES: Record<SupportedLocale, string> = {
  en: 'Shionlib',
  zh: '书音的图书馆',
  ja: '書音の図書館',
}

const DEFAULT_DESCS: Record<SupportedLocale, string> = {
  en: 'Free, open-source, easy-access Visual Novel / Galgame archive.',
  zh: '免费、开源、零门槛的 视觉小说 / Galgame 档案库。',
  ja: '無料・オープンソース・気軽に使える ビジュアルノベル / ギャルゲー アーカイブ。',
}

interface DefaultOgTemplateProps {
  locale: SupportedLocale
  title?: string
  description?: string
}

export function DefaultOgTemplate({ locale, title, description }: DefaultOgTemplateProps) {
  const displayTitle = title || DEFAULT_TITLES[locale]
  const displayDesc = description || DEFAULT_DESCS[locale]
  const fallbackSize = OG_LAYOUT_MAIN_H
  const textFontFamily = getLocaleFontFamily(locale)

  return (
    <OgLayout>
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 64,
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
            gap: 24,
            flex: 1,
            minWidth: 0,
            height: '100%',
            minHeight: 0,
          }}
        >
          <div
            style={{
              fontSize: 72,
              fontWeight: 700,
              color: '#f9fafb',
              fontFamily: `Cinzel, ${textFontFamily}`,
              textShadow: '0 2px 16px rgba(0,0,0,0.5)',
              textOverflow: 'ellipsis',
              overflow: 'hidden',
              flexShrink: 0,
            }}
          >
            {displayTitle}
          </div>

          <div
            style={{
              fontSize: 28,
              lineHeight: 1.5,
              color: '#9ca3af',
              fontFamily: textFontFamily,
              textOverflow: 'ellipsis',
              overflow: 'hidden',
              flex: 1,
              minHeight: 0,
            }}
          >
            {displayDesc}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            width: fallbackSize,
            height: fallbackSize,
            flexShrink: 0,
            borderRadius: 20,
            overflow: 'hidden',
          }}
        >
          <img
            src={FALLBACK_IMAGE_KEY}
            width={fallbackSize}
            height={fallbackSize}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
      </div>
    </OgLayout>
  )
}
