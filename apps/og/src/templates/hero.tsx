import { OG_W, type Locale } from '@/config'
import type { HeroPicture, HeroView } from '@/cards/hero'
import { fitInside, fitTitle, type Box } from '@/cards/measure'
import { fitRow } from '@/cards/tags'
import { Brand, Frame, Icon, icons, padding, Tag, TagRow, tokens, Veil } from './parts'

const columnGap = 56
const pictureArea: Box = { width: 460, height: 502 }
const fixedPictures: Record<Exclude<HeroPicture['shape'], 'cover'>, Box> = {
  portrait: { width: 335, height: 402 },
  banner: { width: 377, height: 502 },
}

function pictureBox(picture: HeroPicture): Box {
  return picture.shape === 'cover'
    ? fitInside(picture.dims, pictureArea)
    : fixedPictures[picture.shape]
}

const muted = {
  color: tokens.muted,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
} as const

export function HeroCard({
  view,
  locale,
  loaded,
}: {
  view: HeroView
  locale: Locale
  loaded: Set<string>
}) {
  const picture = view.picture && loaded.has(view.picture.src) ? view.picture : undefined
  const box = picture ? pictureBox(picture) : undefined
  const textWidth = OG_W - padding * 2 - (box ? box.width + columnGap : 0)
  const title = fitTitle(view.title, textWidth)
  const tags = fitRow(view.tags, view.note, textWidth)
  const avatar =
    view.byline?.avatar && loaded.has(view.byline.avatar) ? view.byline.avatar : undefined
  return (
    <Frame locale={locale} style={{ padding, gap: columnGap, alignItems: 'center' }}>
      <div
        style={{
          flex: 1,
          minWidth: 0,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <Brand locale={locale} logo={48} wordmark={34} gap={16} />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          {view.badge ? (
            <div style={{ display: 'flex', marginBottom: 24 }}>
              <Tag
                label={view.badge.label}
                tone="accent"
                icon={view.badge.icon ? icons[view.badge.icon] : undefined}
              />
            </div>
          ) : null}
          <div
            style={{
              maxWidth: '100%',
              fontSize: title.fontSize,
              fontWeight: 600,
              lineHeight: 1.25,
              lineClamp: title.lines,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              wordBreak: 'break-word',
            }}
          >
            {view.title}
          </div>
          {view.subtitle ? (
            <div
              style={{ maxWidth: '100%', marginTop: 12, fontSize: 32, lineHeight: 1.4, ...muted }}
            >
              {view.subtitle}
            </div>
          ) : null}
          {view.description ? (
            <div
              style={{
                maxWidth: '100%',
                marginTop: 16,
                fontSize: 28,
                lineHeight: 1.5,
                color: tokens.muted,
                lineClamp: 2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {view.description}
            </div>
          ) : null}
          {view.meta ? (
            <div
              style={{ maxWidth: '100%', marginTop: 20, fontSize: 28, lineHeight: 1.4, ...muted }}
            >
              {view.meta}
            </div>
          ) : null}
          {view.facts ? (
            <div
              style={{
                marginTop: 20,
                display: 'flex',
                alignItems: 'center',
                gap: 28,
                fontSize: 28,
                lineHeight: 1.4,
                color: tokens.muted,
              }}
            >
              {view.facts.map(fact => (
                <div key={fact.icon} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Icon paths={icons[fact.icon]} size={28} color={tokens.faint} />
                  <span style={{ whiteSpace: 'nowrap' }}>{fact.text}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
        {view.byline ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 28 }}>
            {avatar ? (
              <img
                src={avatar}
                width={48}
                height={48}
                style={{ width: 48, height: 48, borderRadius: 9999, objectFit: 'cover' }}
              />
            ) : null}
            <span style={{ color: tokens.text, fontWeight: 500, whiteSpace: 'nowrap' }}>
              {view.byline.name}
            </span>
            {view.byline.date ? (
              <span style={{ color: tokens.muted, whiteSpace: 'nowrap' }}>
                {`· ${view.byline.date}`}
              </span>
            ) : null}
          </div>
        ) : (
          <TagRow tags={tags} note={view.note} />
        )}
      </div>
      {picture && box ? <HeroImage picture={picture} box={box} /> : null}
    </Frame>
  )
}

function HeroImage({ picture, box }: { picture: HeroPicture; box: Box }) {
  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        flexShrink: 0,
        width: box.width,
        height: box.height,
        borderRadius: 28,
        overflow: 'hidden',
        border: `2px solid ${tokens.border}`,
        boxShadow: tokens.shadow,
        background: tokens.subtle,
      }}
    >
      <img
        src={picture.src}
        width={box.width}
        height={box.height}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: picture.shape === 'portrait' ? 'top' : 'center',
        }}
      />
      {picture.masked ? <Veil /> : null}
    </div>
  )
}
