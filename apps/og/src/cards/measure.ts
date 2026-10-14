const wide = /[ᄀ-ᅟ⺀-〾ぁ-㏿㐀-䶿一-鿿ꥠ-꥿가-힣豈-﫿︰-﹏＀-｠￠-￦]/

export function textWidth(text: string, fontSize: number): number {
  let ems = 0
  for (const char of text) {
    ems += wide.test(char) ? 1 : 0.55
  }
  return ems * fontSize
}

export type TitleFit = { fontSize: number; lines: number }

const roomy: TitleFit = { fontSize: 60, lines: 2 }
const compact: TitleFit = { fontSize: 48, lines: 3 }

export function fitTitle(title: string, width: number): TitleFit {
  const lines = Math.ceil((textWidth(title, roomy.fontSize) * 1.08) / width)
  return lines > roomy.lines ? compact : roomy
}

export type Box = { width: number; height: number }

export function fitInside(dims: number[], box: Box): Box {
  const [first, second] = dims
  const [w, h] = first && second && first > 0 && second > 0 ? [first, second] : [3, 4]
  const scale = Math.min(box.width / w, box.height / h)
  return { width: Math.round(w * scale), height: Math.round(h * scale) }
}
