import { describe, expect, it } from 'vitest'
import {
  lineOf,
  nextSlot,
  stepFrom,
  stepsFrom,
  textOf,
  withLine,
  type Step,
} from './walkthrough-steps'

const words = { save: '存档', load: '读档' }

function step(kind: Step['kind'], fields: Partial<Step> = {}): Step {
  return { kind, text: '', remark: '', slot: '', ...fields }
}

describe('stepFrom', () => {
  it('reads a line as a choice, with what follows the bar as its remark', () => {
    expect(stepFrom('左')).toEqual(step('choice', { text: '左' }))
    expect(stepFrom('メイド | むぎ＆緋華')).toEqual(
      step('choice', { text: 'メイド', remark: 'むぎ＆緋華' }),
    )
    expect(stepFrom('黒依│黒依＆凛々')).toEqual(
      step('choice', { text: '黒依', remark: '黒依＆凛々' }),
    )
    expect(stepFrom('a｜b | c')).toEqual(step('choice', { text: 'a', remark: 'b c' }))
    expect(stepFrom('| 右')).toEqual(step('choice', { text: '右' }))
  })

  it('reads saves and loads in the words of each language', () => {
    for (const line of [
      '存档 01',
      '存档01',
      'セーブ01',
      '◆セーブ01',
      'SAVE 01',
      'save01',
      'ｾｰﾌﾞ０１',
    ]) {
      expect(stepFrom(line)).toEqual(step('save', { slot: '01' }))
    }
    for (const line of [
      '读档 1',
      '读取存档 1',
      'セーブ1から',
      '◆セーブ 1 から',
      'LOAD 1',
      'ロード1',
    ]) {
      expect(stepFrom(line)).toEqual(step('load', { slot: '1' }))
    }
  })

  it('reads a load the ways walkthroughs on the site write it', () => {
    for (const line of [
      '◆SAVE02开始',
      '◆SAVE 02 开始',
      '◆从存档02开始',
      '存档02開始',
      '◆ Load Save 02',
      '◆读取02',
      '读取 02',
    ]) {
      expect(stepFrom(line)).toEqual(step('load', { slot: '02' }))
    }
    expect(stepFrom('读取中')).toEqual(step('choice', { text: '读取中' }))
    expect(stepFrom('从存档开始')).toEqual(step('choice', { text: '从存档开始' }))
  })

  it('takes a rule of any of the usual characters as a pause', () => {
    for (const line of ['━', '━━━━', '▬▬▬▬▬▬▬▬▬▬', '──────', '=====', '----', '＝＝＝']) {
      expect(stepFrom(line)).toEqual(step('gap'))
    }
    expect(stepFrom('--')).toEqual(step('choice', { text: '--' }))
  })

  it('takes a line that starts with ※ or names an ending as a note', () => {
    for (const line of [
      '※3人攻略后？',
      '里樱 END1(妊娠)',
      '桃花END2',
      '后宫 END',
      'TRUE END(克露露)',
      '凪咲 ＥＮＤ１（支线）',
      'END[想要享受家庭约会]',
    ]) {
      expect(stepFrom(line)).toEqual(step('note', { text: line }))
    }
    for (const line of [
      '与艾莉斯共同走下去(艾莉斯END) / 让她走自己的道路',
      'BEST FRIEND',
      'ENDを見る',
    ]) {
      expect(stepFrom(line).kind).toBe('choice')
    }
  })

  it('keeps what merely starts like a save as a choice', () => {
    expect(stepFrom('存档后继续')).toEqual(step('choice', { text: '存档后继续' }))
    expect(stepFrom('セーブする')).toEqual(step('choice', { text: 'セーブする' }))
    expect(stepFrom('save the cat')).toEqual(step('choice', { text: 'save the cat' }))
    expect(stepFrom('存档 1234')).toEqual(step('choice', { text: '存档 1234' }))
  })

  it('reads a line that starts with a number sign as a note', () => {
    expect(stepFrom('# 【START】')).toEqual(step('note', { text: '【START】' }))
    expect(stepFrom('＃次の章へ')).toEqual(step('note', { text: '次の章へ' }))
    expect(stepFrom('#')).toEqual(step('gap'))
  })

  it('leaves out the mark a pasted line starts with', () => {
    expect(stepFrom('◆ 左')).toEqual(step('choice', { text: '左' }))
    expect(stepFrom('■●◯右')).toEqual(step('choice', { text: '右' }))
    expect(stepFrom('◆')).toEqual(step('gap'))
  })

  it('reads an empty line and a ruled line as a pause', () => {
    expect(stepFrom('   ')).toEqual(step('gap'))
    expect(stepFrom('━━━━━━')).toEqual(step('gap'))
    expect(stepFrom('　')).toEqual(step('gap'))
  })
})

describe('stepsFrom', () => {
  it('keeps one pause between groups and none at either end', () => {
    const steps = stepsFrom('\n\n# 【START】\n左\n\n━━━\n\n存档 01\n右 | むぎ\n\n')
    expect(steps.map(each => each.kind)).toEqual(['note', 'choice', 'gap', 'save', 'choice'])
  })

  it('reads nothing from nothing', () => {
    expect(stepsFrom('')).toEqual([])
    expect(stepsFrom(' \n\r\n')).toEqual([])
  })
})

describe('textOf', () => {
  it('writes steps as the lines they are read from', () => {
    const text = '# 【START】\n左\n\n存档 01\nメイド | むぎ＆緋華\n读档 01'
    expect(textOf(stepsFrom(text), words)).toBe(text)
  })

  it('reads a save or a load with a comment as the step and a note', () => {
    expect(
      stepsFrom('◆SAVE01（调查结束存档）\n◆读档 01 ※事件回收\n◆SAVE02开始(凪咲end后)'),
    ).toEqual([
      step('save', { slot: '01' }),
      step('note', { text: '（调查结束存档）' }),
      step('load', { slot: '01' }),
      step('note', { text: '※事件回收' }),
      step('load', { slot: '02' }),
      step('note', { text: '(凪咲end后)' }),
    ])
    expect(stepsFrom('存档 01 之前的选项不影响分支')).toEqual([
      step('choice', { text: '存档 01 之前的选项不影响分支' }),
    ])
  })

  it('writes saves and loads in the words it is given', () => {
    const japanese = { save: 'セーブ', load: 'ロード' }
    expect(lineOf(step('save', { slot: '02' }), japanese)).toBe('セーブ 02')
    expect(stepFrom(lineOf(step('load', { slot: '02' }), japanese))).toEqual(
      step('load', { slot: '02' }),
    )
  })
})

describe('withLine', () => {
  it('fills the empty line the caret is on', () => {
    expect(withLine({ text: '左\n\n右', caret: 2 }, '存档 01')).toEqual({
      text: '左\n存档 01\n右',
      caret: 7,
    })
    expect(withLine({ text: '', caret: 0 }, '# ')).toEqual({ text: '# ', caret: 2 })
  })

  it('adds a line under the one the caret is on', () => {
    expect(withLine({ text: '左\n右', caret: 1 }, '读档 ')).toEqual({
      text: '左\n读档 \n右',
      caret: 5,
    })
    expect(withLine({ text: '左', caret: 0 }, '# ')).toEqual({ text: '左\n# ', caret: 4 })
  })
})

describe('nextSlot', () => {
  it('follows the highest save, as wide as the saves are written', () => {
    expect(nextSlot([])).toBe('01')
    expect(nextSlot(['01', '02'])).toBe('03')
    expect(nextSlot(['9'])).toBe('10')
    expect(nextSlot(['001', '099'])).toBe('100')
  })
})
