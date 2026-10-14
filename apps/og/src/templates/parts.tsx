import type { CSSProperties, ReactNode } from 'react'
import { OG_H, OG_W, type Locale } from '@/config'
import type { TagItem } from '@/cards/tags'
import { brandImages } from '@/services/renderer'
import { platformIcons } from './platform-icons'

export const tokens = {
  surface: '#ffffff',
  subtle: '#f5f5f5',
  text: '#171717',
  muted: '#525252',
  faint: '#737373',
  border: 'rgba(0, 0, 0, 0.08)',
  accentSoft: '#e9f4fb',
  accentText: '#206a8e',
  veil: 'rgba(255, 255, 255, 0.7)',
  shadow:
    '0 2px 4px rgba(0, 0, 0, 0.06), 0 4px 8px -2px rgba(0, 0, 0, 0.04), 0 8px 16px -4px rgba(0, 0, 0, 0.04)',
} as const

const platformColors: Record<string, { background: string; color: string }> = {
  win: { background: '#0078d7', color: '#ffffff' },
  mac: { background: '#111111', color: '#ffffff' },
  ios: { background: '#1d1d1f', color: '#ffffff' },
  and: { background: '#3ddc84', color: '#0a1b12' },
  lin: { background: '#f5f5f5', color: '#111111' },
  ps3: { background: '#003791', color: '#ffffff' },
  ps4: { background: '#00439c', color: '#ffffff' },
  psv: { background: '#1e4aa8', color: '#ffffff' },
  psp: { background: '#111111', color: '#ffffff' },
  swi: { background: '#e60012', color: '#ffffff' },
  dvd: { background: '#737373', color: '#ffffff' },
}

const neutralSolid = { background: tokens.text, color: tokens.surface }

const fontFamilies: Record<Locale, string> = {
  zh: 'Noto Sans SC, Noto Sans',
  en: 'Noto Sans, Noto Sans SC',
  ja: 'Noto Sans, Noto Sans SC',
}

export const padding = 64

export function Frame({
  locale,
  style,
  children,
}: {
  locale: Locale
  style?: CSSProperties
  children: ReactNode
}) {
  return (
    <div
      style={{
        width: OG_W,
        height: OG_H,
        display: 'flex',
        boxSizing: 'border-box',
        background: tokens.surface,
        color: tokens.text,
        fontFamily: fontFamilies[locale],
        ...style,
      }}
    >
      {children}
    </div>
  )
}

const wordmarks = {
  zh: { src: brandImages.wordmarkZh, ratio: 5989 / 1038, scale: 1 },
  latin: { src: brandImages.wordmark, ratio: 4892 / 874, scale: 0.82 },
}

export function Brand({
  locale,
  logo,
  wordmark,
  gap,
  stacked = false,
}: {
  locale: Locale
  logo: number
  wordmark: number
  gap: number
  stacked?: boolean
}) {
  const mark = locale === 'zh' ? wordmarks.zh : wordmarks.latin
  const height = Math.round(wordmark * mark.scale)
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: stacked ? 'column' : 'row',
        alignItems: stacked ? 'flex-start' : 'center',
        gap,
      }}
    >
      <img
        src={brandImages.logo}
        width={logo}
        height={logo}
        style={{ width: logo, height: logo }}
      />
      <img
        src={mark.src}
        width={Math.round(height * mark.ratio)}
        height={height}
        style={{ width: Math.round(height * mark.ratio), height }}
      />
    </div>
  )
}

export function Icon({ paths, size, color }: { paths: string[]; size: number; color: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths.map(d => (
        <path key={d} d={d} />
      ))}
    </svg>
  )
}

export const icons = {
  eyeOff: [
    'M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49',
    'M14.084 14.158a3 3 0 0 1-4.242-4.242',
    'M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143',
    'm2 2 20 20',
  ],
  size: [
    'M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z',
    'M12 22V12',
    'M3.29 7 12 12 20.71 7',
    'm7.5 4.27 9 5.15',
  ],
  downloads: ['M12 15V3', 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'm7 10 5 5 5-5'],
  map: [
    'M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z',
    'M15 5.764v15',
    'M9 3.236v15',
  ],
}

type TagTone = 'neutral' | 'accent'

export function Tag({
  label,
  tone = 'neutral',
  size = 'lg',
  icon,
}: {
  label: string
  tone?: TagTone
  size?: 'lg' | 'md'
  icon?: string[]
}) {
  const large = size === 'lg'
  const colors =
    tone === 'accent'
      ? { background: tokens.accentSoft, color: tokens.accentText }
      : { background: tokens.subtle, color: tokens.text }
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        height: large ? 56 : 48,
        padding: large ? '0 20px' : '0 16px',
        borderRadius: 12,
        fontSize: large ? 28 : 26,
        fontWeight: 500,
        whiteSpace: 'nowrap',
        flexShrink: 0,
        ...colors,
      }}
    >
      {icon ? <Icon paths={icon} size={32} color={colors.color} /> : null}
      <span>{label}</span>
    </div>
  )
}

export function PlatformTag({ platform, label }: { platform: string; label: string }) {
  const shape = platformIcons[platform]
  const colors = platformColors[platform] ?? neutralSolid
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        height: 56,
        padding: '0 20px',
        borderRadius: 12,
        fontSize: 28,
        fontWeight: 500,
        whiteSpace: 'nowrap',
        flexShrink: 0,
        ...colors,
      }}
    >
      {shape ? (
        <svg viewBox={shape.viewBox} width={32} height={32} fill={colors.color}>
          {shape.paths.map(d => (
            <path key={d} d={d} />
          ))}
        </svg>
      ) : null}
      <span>{label}</span>
    </div>
  )
}

export function TagRow({ tags, note }: { tags: TagItem[]; note?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
      {tags.map(tag =>
        tag.kind === 'platform' ? (
          <PlatformTag key={`p-${tag.platform}`} platform={tag.platform} label={tag.label} />
        ) : (
          <Tag key={`s-${tag.label}`} label={tag.label} />
        ),
      )}
      {note ? (
        <span
          style={{
            marginLeft: tags.length > 0 ? 12 : 0,
            fontSize: 28,
            color: tokens.muted,
            whiteSpace: 'nowrap',
          }}
        >
          {note}
        </span>
      ) : null}
    </div>
  )
}

export function Veil({ circle = 88, icon = 40 }: { circle?: number; icon?: number }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: circle,
          height: circle,
          borderRadius: 9999,
          background: tokens.veil,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: tokens.text,
        }}
      >
        <Icon paths={icons.eyeOff} size={icon} color={tokens.text} />
      </div>
    </div>
  )
}
