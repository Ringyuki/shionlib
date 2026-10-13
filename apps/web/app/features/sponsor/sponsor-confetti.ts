const tokens = ['--hn-accent', '--hn-success', '--hn-warning', '--hn-danger'] as const

const sprays = 1200

const sides = [
  { angle: 60, origin: { x: 0, y: 0.92 } },
  { angle: 120, origin: { x: 1, y: 0.92 } },
] as const

function hexOf(color: string): string | undefined {
  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  const context = canvas.getContext('2d')
  if (context === null || color === '') {
    return undefined
  }
  context.fillStyle = color
  context.fillRect(0, 0, 1, 1)
  const [red = 0, green = 0, blue = 0] = context.getImageData(0, 0, 1, 1).data
  return `#${[red, green, blue].map(part => part.toString(16).padStart(2, '0')).join('')}`
}

function palette(): string[] {
  const style = window.getComputedStyle(document.documentElement)
  return tokens.flatMap(token => hexOf(style.getPropertyValue(token).trim()) ?? [])
}

export async function celebrate() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return
  }
  const { default: confetti } = await import('canvas-confetti')
  const colors = palette()
  const until = Date.now() + sprays
  const spray = () => {
    for (const side of sides) {
      void confetti({
        particleCount: 4,
        spread: 58,
        startVelocity: 62,
        ticks: 180,
        colors: colors.length === 0 ? undefined : colors,
        disableForReducedMotion: true,
        ...side,
      })
    }
    if (Date.now() < until) {
      window.requestAnimationFrame(spray)
    }
  }
  spray()
}
