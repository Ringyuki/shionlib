import type { SupportedLocale } from '@/config'
import { FALLBACK_IMAGE_KEY } from '@/services/renderer'
import { OG_LAYOUT_MAIN_H, OgLayout } from './shared/og-layout'
import { getLocaleFontFamily } from './shared/locale-font'

const CATEGORY_LABELS: Record<string, Record<SupportedLocale, string>> = {
  guides: { en: 'Guides', zh: '指南', ja: 'ガイド' },
  dev: { en: 'Dev', zh: '开发', ja: '開発' },
  about: { en: 'About', zh: '关于', ja: 'について' },
}

const BANNER_W = 380
const GAP = 48

export interface DocsOgTemplateProps {
  locale: SupportedLocale
  title: string
  description?: string
  banner?: string
  authorName?: string
  authorAvatar?: string
  category?: string
}

export function DocsOgTemplate({
  locale,
  title,
  description,
  banner,
  authorName,
  authorAvatar,
  category,
}: DocsOgTemplateProps) {
  const textFontFamily = getLocaleFontFamily(locale)
  const categoryLabel = category ? (CATEGORY_LABELS[category]?.[locale] ?? category) : null
  const imageUrl = banner || FALLBACK_IMAGE_KEY

  return (
    <OgLayout>
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          gap: GAP,
          alignItems: 'stretch',
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
            gap: 20,
            flex: 1,
            minWidth: 0,
            height: '100%',
            minHeight: 0,
            justifyContent: 'center',
          }}
        >
          {categoryLabel ? (
            <div
              style={{
                display: 'flex',
                alignSelf: 'flex-start',
                fontSize: 22,
                fontWeight: 600,
                fontFamily: textFontFamily,
                color: '#a78bfa',
                background: 'rgba(167,139,250,0.12)',
                borderRadius: 8,
                padding: '4px 16px',
                flexShrink: 0,
              }}
            >
              {categoryLabel}
            </div>
          ) : null}

          <div
            style={{
              fontSize: 58,
              fontWeight: 700,
              fontFamily: textFontFamily,
              color: '#f9fafb',
              textShadow: '0 2px 12px rgba(0,0,0,0.4)',
              textOverflow: 'ellipsis',
              overflow: 'hidden',
              lineClamp: 2,
              wordBreak: 'break-word',
              flexShrink: 0,
              lineHeight: 1.25,
            }}
          >
            {title}
          </div>

          {description ? (
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
                wordBreak: 'break-word',
              }}
            >
              {description}
            </div>
          ) : null}

          {authorName ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                flexShrink: 0,
              }}
            >
              {authorAvatar ? (
                <div
                  style={{
                    display: 'flex',
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    overflow: 'hidden',
                    flexShrink: 0,
                    border: '2px solid rgba(255,255,255,0.15)',
                  }}
                >
                  <img
                    src={authorAvatar}
                    width={48}
                    height={48}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
              ) : null}
              <div
                style={{
                  fontSize: 32,
                  fontWeight: 600,
                  color: '#f9fafb',
                  fontFamily: textFontFamily,
                }}
              >
                {authorName.toLocaleUpperCase()}
              </div>
            </div>
          ) : null}
        </div>

        <div
          style={{
            display: 'flex',
            width: BANNER_W,
            height: OG_LAYOUT_MAIN_H,
            flexShrink: 0,
            borderRadius: 16,
            overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          }}
        >
          <img
            src={imageUrl}
            width={BANNER_W}
            height={OG_LAYOUT_MAIN_H}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
      </div>
    </OgLayout>
  )
}
