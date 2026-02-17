'use client'

import * as React from 'react'

type GradientIconProps = {
  icon: React.ReactElement<SVGSVGElement>
  gradient?: string
  gradientId?: string
}

function parseGradient(gradient?: string): {
  from: string
  to: string
} {
  const fallback = { from: '#3b82f6', to: '#a855f7' }
  if (!gradient) return fallback
  const match = gradient.match(/linear-gradient\(([^,]+),\s*(.+)\)/i)
  const stopsPart = match?.[2] ?? gradient
  const parts = stopsPart
    .split(',')
    .map(p => p.trim())
    .filter(Boolean)
  if (parts.length < 2) return fallback

  const pickColor = (token: string) => token.split(/\s+/)[0]
  const from = pickColor(parts[0])
  const to = pickColor(parts[parts.length - 1])
  return { from, to }
}

export function GradientIcon({ icon, gradient, gradientId }: GradientIconProps) {
  const id = gradientId?.replace(/:/g, '') ?? ''
  const { from, to } = parseGradient(gradient)

  return React.cloneElement(
    icon,
    {
      ...icon.props,
      style: {
        ...icon.props.style,
        stroke: `url(#${id})`,
      },
    },
    <>
      <defs>
        <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={from} />
          <stop offset="100%" stopColor={to} />
        </linearGradient>
      </defs>
      {icon.props.children}
    </>,
  )
}

export type { GradientIconProps }
