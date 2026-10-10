import type { Schema } from '~/shared/api/types'

export type Step = Schema<'WalkthroughStepDTO'>

export type StepWords = { save: string; load: string }

export type Typed = { text: string; caret: number }

const bullets = /^[◆■●◯]+\s*/u

const ruled = /^(?:[━▬─═]+|[=＝\-－—_*]{3,})$/u

const flagged = /^※/u

const ended = /(?<![A-Za-z])END\s*\d*\s*(?:[([].*[)\]])?$/u

const commented = /^(.+?)\s*([※(（].*)$/u

const remarked = /\s*[|│｜]\s*/u

const noted = /^[#＃]\s*/u

const saved = /^(?:存档|セーブ|save)\s*(\d{1,3})$/iu

const loaded =
  /^(?:(?:读档|读取存档|读取|ロード|load(?:\s*save)?)\s*(\d{1,3})|从?\s*(?:存档|セーブ|save)\s*(\d{1,3})\s*(?:から|开始|開始))$/iu

const gap: Step = { kind: 'gap', text: '', remark: '', slot: '' }

export function stepFrom(line: string): Step {
  const said = line.trim().replace(bullets, '')
  if (said === '' || ruled.test(said)) {
    return gap
  }
  if (noted.test(said)) {
    const text = said.replace(noted, '')
    return text === '' ? gap : { kind: 'note', text, remark: '', slot: '' }
  }
  const plain = said.normalize('NFKC')
  const load = loaded.exec(plain)
  const slot = load?.[1] ?? load?.[2]
  if (slot !== undefined) {
    return { kind: 'load', text: '', remark: '', slot }
  }
  const save = saved.exec(plain)?.[1]
  if (save !== undefined) {
    return { kind: 'save', text: '', remark: '', slot: save }
  }
  if (flagged.test(said) || ended.test(plain)) {
    return { kind: 'note', text: said, remark: '', slot: '' }
  }
  const [text = '', ...rest] = said.split(remarked)
  const remark = rest.join(' ').trim()
  return text === ''
    ? { kind: 'choice', text: remark, remark: '', slot: '' }
    : { kind: 'choice', text, remark, slot: '' }
}

function stepsOfLine(line: string): Step[] {
  const [, head, comment] = commented.exec(line.trim()) ?? []
  if (head !== undefined && comment !== undefined) {
    const kept = stepFrom(head)
    if (kept.kind === 'save' || kept.kind === 'load') {
      return [kept, { kind: 'note', text: comment.trim(), remark: '', slot: '' }]
    }
  }
  return [stepFrom(line)]
}

export function stepsFrom(text: string): Step[] {
  const steps: Step[] = []
  for (const step of text.split('\n').flatMap(stepsOfLine)) {
    if (step.kind !== 'gap' || (steps.length > 0 && steps.at(-1)?.kind !== 'gap')) {
      steps.push(step)
    }
  }
  return steps.at(-1)?.kind === 'gap' ? steps.slice(0, -1) : steps
}

export function lineOf(step: Step, words: StepWords): string {
  switch (step.kind) {
    case 'choice':
      return step.remark === '' ? step.text : `${step.text} | ${step.remark}`
    case 'save':
      return `${words.save} ${step.slot}`
    case 'load':
      return `${words.load} ${step.slot}`
    case 'note':
      return `# ${step.text}`
    case 'gap':
      return ''
  }
}

export function textOf(steps: readonly Step[], words: StepWords): string {
  return steps.map(step => lineOf(step, words)).join('\n')
}

export function withLine({ text, caret }: Typed, line: string): Typed {
  const start = text.lastIndexOf('\n', caret - 1) + 1
  const next = text.indexOf('\n', caret)
  const end = next === -1 ? text.length : next
  if (text.slice(start, end).trim() === '') {
    return { text: text.slice(0, start) + line + text.slice(end), caret: start + line.length }
  }
  return {
    text: `${text.slice(0, end)}\n${line}${text.slice(end)}`,
    caret: end + 1 + line.length,
  }
}

export function nextSlot(slots: readonly string[]): string {
  const width = Math.max(2, ...slots.map(slot => slot.length))
  const highest = Math.max(0, ...slots.map(slot => Number.parseInt(slot, 10)))
  return String(highest + 1).padStart(width, '0')
}
