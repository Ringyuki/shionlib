import { describe, expect, it } from 'vitest'
import bbcodeToHtml from '../../../utils/bbcode/format'

describe('utils/bbcode/format (unit)', () => {
  it('renders basic tags and escapes unsafe html', () => {
    const html = bbcodeToHtml('[b]Bold[/b] [i]Italic[/i] <script>alert(1)</script>')

    expect(html).toContain('<span class="font-bold">Bold</span>')
    expect(html).toContain('<em>Italic</em>')
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
  })

  it('sanitizes urls and applies size/color/list transforms', () => {
    const html = bbcodeToHtml(
      '[url]javascript:alert(1)[/url]\n[url=https://example.com/test path]site[/url]\n[size=999]Huge[/size]\n[color=#fff]Color[/color]\n[color=red]Unsafe[/color]\n[list][*]A[*]B[/list]',
    )

    expect(html).not.toContain('href="javascript:alert(1)"')
    expect(html).toContain('href="https://example.com/testpath"')
    expect(html).toContain('font-size:64px')
    expect(html).toContain('<span style="color:#fff">Color</span>')
    expect(html).toContain('>Unsafe<')
    expect(html).toContain('<ul><li>A</li><li>B</li></ul>')
  })

  it('keeps code blocks raw and supports newlineToBr toggle', () => {
    const withBr = bbcodeToHtml('[code][b]x[/b]</code>[/code]\nline2')
    const withoutBr = bbcodeToHtml('line1\nline2', { newlineToBr: false })

    expect(withBr).toContain('<pre><code>[b]x[/b]&lt;/code&gt;</code></pre><br />line2')
    expect(withoutBr).toBe('line1\nline2')
  })
})
