import { isWebAddress } from './bbcode'

export type BBCodeTool =
  'bold' | 'italic' | 'strike' | 'link' | 'quote' | 'spoiler' | 'heading' | 'subheading' | 'list'

export type TextEdit = { text: string; start: number; end: number }

const tags: Record<Exclude<BBCodeTool, 'link' | 'list'>, string> = {
  bold: 'b',
  italic: 'i',
  strike: 's',
  quote: 'quote',
  spoiler: 'spoiler',
  heading: 'h2',
  subheading: 'h3',
}

export function applyBBCodeTool(edit: TextEdit, tool: BBCodeTool): TextEdit {
  if (tool === 'link') {
    return linked(edit)
  }
  if (tool === 'list') {
    return listed(edit)
  }
  const open = `[${tags[tool]}]`
  const close = `[/${tags[tool]}]`
  return unwrapped(edit, open, close) ?? wrapped(edit, open, close)
}

function listed({ text, start, end }: TextEdit): TextEdit {
  const open = '[list]\n'
  const items = text
    .slice(start, end)
    .split('\n')
    .map(line => `[*]${line}`)
    .join('\n')
  const first = start + open.length + '[*]'.length
  return {
    text: `${text.slice(0, start)}${open}${items}\n[/list]${text.slice(end)}`,
    start: first,
    end: start + open.length + items.length,
  }
}

function linked(edit: TextEdit): TextEdit {
  const label = edit.text.slice(edit.start, edit.end)
  if (label === '' || isWebAddress(label)) {
    return wrapped(edit, '[url]', '[/url]')
  }
  const open = '[url='
  const cursor = edit.start + open.length
  return { ...wrapped(edit, `${open}]`, '[/url]'), start: cursor, end: cursor }
}

function wrapped({ text, start, end }: TextEdit, open: string, close: string): TextEdit {
  return {
    text: `${text.slice(0, start)}${open}${text.slice(start, end)}${close}${text.slice(end)}`,
    start: start + open.length,
    end: end + open.length,
  }
}

function unwrapped(
  { text, start, end }: TextEdit,
  open: string,
  close: string,
): TextEdit | undefined {
  const before = text.slice(start - open.length, start).toLowerCase()
  const after = text.slice(end, end + close.length).toLowerCase()
  if (start < open.length || before !== open || after !== close) {
    return undefined
  }
  return {
    text: `${text.slice(0, start - open.length)}${text.slice(start, end)}${text.slice(end + close.length)}`,
    start: start - open.length,
    end: end - open.length,
  }
}
