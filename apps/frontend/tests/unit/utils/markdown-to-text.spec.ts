import { describe, expect, it } from 'vitest'
import { markdownToText } from '../../../utils/markdown-to-text'

describe('utils/markdown-to-text (unit)', () => {
  it('strips markdown syntax and keeps plain text', () => {
    const input = `
# Title
**bold** _italic_
[link](https://example.com)
![image](https://example.com/a.png)
- item
\`inline\`
`

    const text = markdownToText(input)
    expect(text).toContain('Title')
    expect(text).toContain('bold')
    expect(text).toContain('italic')
    expect(text).toContain('link')
    expect(text).not.toContain('https://example.com')
    expect(text).not.toContain('#')
    expect(text).not.toContain('**')
  })
})
