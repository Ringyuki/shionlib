import type { SerializedEditorState } from 'lexical'
import {
  detectWalkthroughLanguage,
  detectWalkthroughLanguageFromEditorState,
} from './language-detector.util'

const findLanguageMock = jest.fn()
const createMock = jest.fn(() => ({ findLanguage: findLanguageMock }))
const loadModuleMock = jest.fn(async () => ({ create: createMock }))

jest.mock('cld3-asm', () => ({
  loadModule: () => loadModuleMock(),
}))

function makeState(...paragraphs: string[][]): SerializedEditorState {
  return {
    root: {
      type: 'root',
      version: 1,
      children: paragraphs.map(texts => ({
        type: 'paragraph',
        version: 1,
        children: texts.map(text => ({ type: 'text', version: 1, text })),
      })),
    },
  } as unknown as SerializedEditorState
}

describe('walkthrough language detector', () => {
  beforeEach(() => {
    findLanguageMock.mockReset()
    createMock.mockClear()
    loadModuleMock.mockClear()
  })

  it('returns unknown for empty input', async () => {
    await expect(detectWalkthroughLanguage('')).resolves.toBe('unknown')
    expect(loadModuleMock).not.toHaveBeenCalled()
  })

  it('prefers zh when chinese text contains a few japanese chars', async () => {
    findLanguageMock.mockReturnValue({ language: 'ja', probability: 0.9, is_reliable: true })

    const text =
      '这是一个中文攻略，主要讲解路线选择和结局条件，里面夹杂角色名さくら和系统提示。请按照步骤操作。'
    await expect(detectWalkthroughLanguage(text)).resolves.toBe('zh')
  })

  it('detects japanese when kana usage is substantial', async () => {
    const text =
      'この攻略では、はじめに共通ルートを進めて、三日目の選択肢でヒロイン分岐に入ります。'
    await expect(detectWalkthroughLanguage(text)).resolves.toBe('jp')
    expect(loadModuleMock).not.toHaveBeenCalled()
  })

  it('detects zh-hant via traditional-only chars', async () => {
    const text = '這篇攻略會說明遊戲流程與結局條件，請依照步驟選擇。'
    await expect(detectWalkthroughLanguage(text)).resolves.toBe('zh-hant')
  })

  it('extracts text from serialized editor state', async () => {
    findLanguageMock.mockReturnValue({ language: 'en', probability: 0.9, is_reliable: true })
    const state = makeState(['Route guide'], ['Choose option A first'])
    await expect(detectWalkthroughLanguageFromEditorState(state, 'Walkthrough')).resolves.toBe('en')
  })
})
