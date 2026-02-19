// @vitest-environment jsdom
import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/components/shionui/SpoilerText', () => ({
  SpoilerText: ({ children }: { children: React.ReactNode }) =>
    React.createElement('span', { 'data-testid': 'spoiler-text' }, children),
}))

import { bbcodeRender, supportedTags } from '../../../utils/bbcode/render'

describe('utils/bbcode/render (unit)', () => {
  it('exposes supported tags used by parser', () => {
    expect(supportedTags).toEqual([
      'bold',
      'italic',
      'underline',
      'strikethrough',
      'quote',
      'spoiler',
      'mask',
      'url',
      'urlWithLabel',
    ])
  })

  it('renders nested tags, links and spoiler/mask as react nodes', () => {
    const node = bbcodeRender(
      '[b]Bold [i]Italic[/i][/b] [url=https://example.com]site[/url] [spoiler]secret[/spoiler] [mask]hide[/mask]',
    )

    const { container } = render(React.createElement('div', null, node))

    const bold = container.querySelector('span.font-bold') as HTMLElement

    expect(bold).toBeTruthy()
    expect(bold.textContent).toBe('Bold Italic')
    expect(screen.getByText('Italic').tagName).toBe('EM')
    expect(screen.getByRole('link', { name: 'site' }).getAttribute('href')).toBe(
      'https://example.com',
    )
    expect(screen.getAllByTestId('spoiler-text')).toHaveLength(2)
  })

  it('keeps unsafe urls as text and renders code/newline segments', () => {
    const node = bbcodeRender('[url]javascript:alert(1)[/url]\n[code]const a = 1[/code]')

    render(React.createElement('div', null, node))

    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByText('javascript:alert(1)')).toBeTruthy()
    expect(screen.getByText('const a = 1').tagName).toBe('CODE')
  })

  it('returns null for empty content', () => {
    expect(bbcodeRender('   ')).toBeNull()
  })
})
