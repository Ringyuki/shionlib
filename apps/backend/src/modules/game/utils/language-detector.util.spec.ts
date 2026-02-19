import { franc } from 'franc'
import { detectLanguage } from './language-detector.util'

jest.mock('franc', () => ({
  franc: jest.fn(),
}))

describe('detectLanguage', () => {
  beforeEach(() => {
    ;(franc as jest.Mock).mockReset()
  })

  it('returns unknown for empty input without calling franc', async () => {
    await expect(detectLanguage('')).resolves.toBe('unknown')
    expect(franc).not.toHaveBeenCalled()
  })

  it('maps franc codes to project language codes', async () => {
    ;(franc as jest.Mock).mockReturnValueOnce('jpn')
    await expect(detectLanguage('jp-sample')).resolves.toBe('jp')
    ;(franc as jest.Mock).mockReturnValueOnce('zho')
    await expect(detectLanguage('zh-sample')).resolves.toBe('zh')
    ;(franc as jest.Mock).mockReturnValueOnce('eng')
    await expect(detectLanguage('en-sample')).resolves.toBe('en')
    ;(franc as jest.Mock).mockReturnValueOnce('spa')
    await expect(detectLanguage('unknown-sample')).resolves.toBe('unknown')
  })

  it('uses in-memory cache for repeated inputs', async () => {
    ;(franc as jest.Mock).mockReturnValue('eng')

    await expect(detectLanguage('cache-hit-input')).resolves.toBe('en')
    await expect(detectLanguage('cache-hit-input')).resolves.toBe('en')

    expect(franc).toHaveBeenCalledTimes(1)
  })
})
