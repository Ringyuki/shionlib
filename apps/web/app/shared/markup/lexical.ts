export type LexicalNode = {
  type: string
  text?: string | null
  format?: number | string | null
  url?: string | null
  tag?: string | null
  listType?: string | null
  children?: LexicalNode[] | null
}

export const formatBits = { bold: 1, italic: 2, strike: 4, underline: 8 } as const

const formatTags = [
  ['b', formatBits.bold],
  ['i', formatBits.italic],
  ['s', formatBits.strike],
  ['u', formatBits.underline],
] as const

const mainHeadings = new Set(['h1', 'h2'])

export function bbcodeSource(root: LexicalNode): string {
  return (root.children ?? []).map(blockSource).join('\n').trim()
}

function blockSource(node: LexicalNode): string {
  if (node.type === 'quote') {
    return `[quote]${inlineSource(node)}[/quote]`
  }
  if (node.type === 'heading') {
    const title = inlineSource(node)
    const tag = mainHeadings.has(node.tag ?? '') ? 'h2' : 'h3'
    return title === '' ? '' : `[${tag}]${title}[/${tag}]`
  }
  if (node.type === 'list') {
    const items = (node.children ?? []).map(item => `[*]${inlineSource(item)}`)
    return [node.listType === 'number' ? '[list=1]' : '[list]', ...items, '[/list]'].join('\n')
  }
  if (node.type === 'table' || node.type === 'tablerow') {
    return (node.children ?? []).map(blockSource).join('\n')
  }
  return inlineSource(node)
}

function inlineSource(node: LexicalNode): string {
  return (node.children ?? [])
    .map(child => {
      if (child.type === 'linebreak') {
        return '\n'
      }
      if (child.type === 'text' || child.children == null) {
        return styledSource(child.text ?? '', child.format)
      }
      if (child.type === 'spoiler') {
        return `[spoiler]${inlineSource(child)}[/spoiler]`
      }
      if (child.type === 'link' || child.type === 'autolink') {
        return linkSource(inlineSource(child), (child.url ?? '').trim())
      }
      return blockSource(child)
    })
    .join('')
}

function styledSource(text: string, format: LexicalNode['format']): string {
  const bits = typeof format === 'number' ? format : 0
  return formatTags.reduce(
    (source, [tag, bit]) =>
      (bits & bit) === 0 || text === '' ? source : `[${tag}]${source}[/${tag}]`,
    text,
  )
}

function linkSource(label: string, url: string): string {
  if (url === '') {
    return label
  }
  return label === url ? `[url]${url}[/url]` : `[url=${url}]${label}[/url]`
}
