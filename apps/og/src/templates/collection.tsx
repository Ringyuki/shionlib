import type { Locale } from '@/config'
import type { CollectionView, HomeView, Shelf } from '@/cards/collection'
import { Brand, Frame, padding, tokens, Veil } from './parts'

const shelfItem = { width: 176, height: 250 }

function ShelfCover({ cover }: { cover: Shelf }) {
  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        flexShrink: 0,
        width: shelfItem.width,
        height: shelfItem.height,
        borderRadius: 16,
        overflow: 'hidden',
        border: `2px solid ${tokens.border}`,
        background: tokens.subtle,
      }}
    >
      <img
        src={cover.src}
        width={shelfItem.width}
        height={shelfItem.height}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
      {cover.masked ? <Veil circle={56} icon={26} /> : null}
    </div>
  )
}

export function CollectionCard({
  view,
  locale,
  loaded,
}: {
  view: CollectionView
  locale: Locale
  loaded: Set<string>
}) {
  const shelf = view.shelf.filter(cover => loaded.has(cover.src))
  const logo = view.logo && loaded.has(view.logo) ? view.logo : undefined
  return (
    <Frame
      locale={locale}
      style={{ padding, flexDirection: 'column', justifyContent: 'space-between' }}
    >
      <Brand locale={locale} logo={48} wordmark={34} gap={16} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 32, minWidth: 0 }}>
        {logo ? (
          <img
            src={logo}
            width={112}
            height={112}
            style={{
              width: 112,
              height: 112,
              flexShrink: 0,
              objectFit: 'contain',
              borderRadius: 16,
              border: `2px solid ${tokens.border}`,
              background: tokens.surface,
            }}
          />
        ) : null}
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              fontSize: 56,
              fontWeight: 600,
              lineHeight: 1.25,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {view.name}
          </div>
          {view.subtitle ? (
            <div
              style={{
                marginTop: 8,
                fontSize: 28,
                lineHeight: 1.4,
                color: tokens.muted,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {view.subtitle}
            </div>
          ) : null}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 20, height: shelfItem.height }}>
        {shelf.map(cover => (
          <ShelfCover key={cover.src} cover={cover} />
        ))}
      </div>
    </Frame>
  )
}

export function HomeCard({
  view,
  locale,
  loaded,
  host,
}: {
  view: HomeView
  locale: Locale
  loaded: Set<string>
  host: string
}) {
  const shelf = view.shelf.filter(cover => loaded.has(cover.src))
  return (
    <Frame locale={locale} style={{ padding, gap: 56, alignItems: 'center' }}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <Brand locale={locale} logo={112} wordmark={60} gap={36} stacked />
        <div style={{ marginTop: 24, fontSize: 32, lineHeight: 1.4, color: tokens.muted }}>
          {host}
        </div>
      </div>
      {shelf.length > 0 ? (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 20,
            width: shelfItem.width * 3 + 40,
            flexShrink: 0,
          }}
        >
          {shelf.map(cover => (
            <ShelfCover key={cover.src} cover={cover} />
          ))}
        </div>
      ) : null}
    </Frame>
  )
}
