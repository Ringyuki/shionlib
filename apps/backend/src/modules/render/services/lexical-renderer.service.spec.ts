import sanitizeHtml from 'sanitize-html'
import { LexicalRendererService } from './lexical-renderer.service'

const mockParseEditorState = jest.fn()
const mockSetEditorState = jest.fn()
const mockGenerateHtmlFromNodes = jest.fn()

jest.mock('@lexical/headless', () => ({
  createHeadlessEditor: jest.fn(() => ({
    parseEditorState: mockParseEditorState,
    setEditorState: mockSetEditorState,
  })),
}))

jest.mock('@lexical/html', () => ({
  $generateHtmlFromNodes: (...args: any[]) => mockGenerateHtmlFromNodes(...args),
}))

jest.mock('sanitize-html', () => {
  const fn: any = jest.fn((html: string) => html)
  fn.defaults = { allowedTags: ['p'] }
  return fn
})

jest.mock('../providers/dom-env.provider', () => ({
  withDomEnv: (fn: any) => fn({}, undefined),
}))

describe('LexicalRendererService', () => {
  beforeEach(() => {
    mockParseEditorState.mockReset()
    mockSetEditorState.mockReset()
    mockGenerateHtmlFromNodes.mockReset()
  })

  it('renders lexical serialized state to sanitized html', () => {
    const state = {
      read: (cb: () => void) => cb(),
    }
    mockParseEditorState.mockReturnValue(state)
    mockGenerateHtmlFromNodes.mockReturnValue(
      '<pre class="language-js"><code>line1<br>line2</code></pre>',
    )
    const service = new LexicalRendererService()

    const html = service.toHtml('{}')

    expect(mockParseEditorState).toHaveBeenCalledWith('{}')
    expect(mockSetEditorState).toHaveBeenCalledWith(state)
    expect(mockGenerateHtmlFromNodes).toHaveBeenCalled()
    expect(sanitizeHtml).toHaveBeenCalledTimes(1)
    expect(html).toBe('<pre class="language-js"><code>line1<br>line2</code></pre>')
  })

  it('returns raw html when no document is provided in code block handler', () => {
    const service = new LexicalRendererService()
    const raw = '<pre><code>x</code></pre>'

    expect((service as any).handleCodeBlocks(raw, undefined)).toBe(raw)
  })
})
