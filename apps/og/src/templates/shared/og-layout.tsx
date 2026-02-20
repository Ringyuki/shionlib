import type { ReactNode } from 'react'
import { Header } from './header'
import { Footer } from './footer'

const OG_W = 1200
const OG_H = 630
const PADDING = 64
const HEADER_H = 56
const FOOTER_H = 24
const SECTION_GAP = 16
export const OG_LAYOUT_MAIN_H = OG_H - PADDING * 2 - HEADER_H - FOOTER_H - SECTION_GAP * 2

interface OgLayoutProps {
  children: ReactNode
}

export function OgLayout({ children }: OgLayoutProps) {
  return (
    <div
      style={{
        width: OG_W,
        height: OG_H,
        padding: PADDING,
        display: 'flex',
        flexDirection: 'column',
        gap: SECTION_GAP,
        boxSizing: 'border-box',
        background: 'linear-gradient(135deg, #0f172a 0%, #111827 50%, #1f2937 100%)',
        color: '#e5e7eb',
      }}
    >
      <div
        style={{
          height: HEADER_H,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'flex-start',
          overflow: 'hidden',
        }}
      >
        <Header />
      </div>

      <div
        style={{
          height: OG_LAYOUT_MAIN_H,
          minHeight: 0,
          flexShrink: 0,
          overflow: 'hidden',
          display: 'flex',
          width: '100%',
        }}
      >
        {children}
      </div>

      <div
        style={{
          height: FOOTER_H,
          flexShrink: 0,
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'flex-end',
          overflow: 'hidden',
        }}
      >
        <Footer />
      </div>
    </div>
  )
}
