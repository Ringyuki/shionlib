import { OG_W, type Locale } from '@/config'
import type { ProfileView } from '@/cards/collection'
import { formatNumber } from '@/i18n/format'
import { Brand, Frame, padding, Tag, tokens } from './parts'

const coverHeight = 250
const avatarSize = 164
const avatarRing = 6
const avatarTop = 162

export function ProfileCard({
  view,
  locale,
  loaded,
}: {
  view: ProfileView
  locale: Locale
  loaded: Set<string>
}) {
  const cover = view.cover && loaded.has(view.cover) ? view.cover : undefined
  const avatar = view.avatar && loaded.has(view.avatar) ? view.avatar : undefined
  return (
    <Frame locale={locale} style={{ position: 'relative', overflow: 'hidden' }}>
      {cover ? (
        <img
          src={cover}
          width={OG_W}
          height={coverHeight}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: OG_W,
            height: coverHeight,
            objectFit: 'cover',
          }}
        />
      ) : (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: OG_W,
            height: coverHeight,
            background: tokens.subtle,
          }}
        />
      )}
      <div
        style={{
          position: 'absolute',
          left: padding,
          top: avatarTop,
          width: avatarSize,
          height: avatarSize,
          borderRadius: 9999,
          border: `${avatarRing}px solid ${tokens.surface}`,
          background: tokens.subtle,
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxSizing: 'border-box',
        }}
      >
        {avatar ? (
          <img
            src={avatar}
            width={avatarSize}
            height={avatarSize}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <span style={{ fontSize: 64, fontWeight: 500, color: tokens.muted }}>
            {Array.from(view.name)[0]?.toUpperCase() ?? ''}
          </span>
        )}
      </div>
      <div
        style={{
          position: 'absolute',
          left: padding,
          right: padding,
          top: 354,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
          <span
            style={{
              fontSize: 52,
              fontWeight: 600,
              lineHeight: 1.25,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {view.name}
          </span>
          {view.marks.map(mark => (
            <Tag key={mark.label} label={mark.label} tone={mark.tone} size="md" />
          ))}
        </div>
        {view.bio ? (
          <div
            style={{
              marginTop: 12,
              fontSize: 28,
              lineHeight: 1.5,
              color: tokens.muted,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {view.bio}
          </div>
        ) : null}
      </div>
      <div
        style={{
          position: 'absolute',
          left: padding,
          right: padding,
          bottom: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 36, fontSize: 28 }}>
          {view.stats.map(stat => (
            <div key={stat.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: tokens.muted }}>{stat.label}</span>
              <span style={{ color: tokens.text, fontWeight: 600 }}>
                {formatNumber(locale, stat.value)}
              </span>
            </div>
          ))}
        </div>
        <Brand locale={locale} logo={40} wordmark={28} gap={14} />
      </div>
    </Frame>
  )
}
