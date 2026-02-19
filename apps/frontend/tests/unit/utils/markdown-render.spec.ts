// @vitest-environment jsdom
import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/components/shionui/ImageLightbox', () => ({
  ImageLightbox: ({ src, alt }: { src: string; alt: string }) =>
    React.createElement('img', { src, alt, 'data-testid': 'md-image' }),
}))

import { markdownRender } from '../../../utils/markdown/render'

describe('utils/markdown/render (unit)', () => {
  it('renders heading, emphasis, links and list blocks', () => {
    const node = markdownRender(
      '# Title\n\nSome **bold** _italic_ ~~gone~~ [site](https://example.com)\n\n- first\n- second',
    )

    render(React.createElement('div', null, node))

    expect(screen.getByText('Title').tagName).toBe('H1')
    expect(screen.getByText('bold').tagName).toBe('SPAN')
    expect(screen.getByText('italic').tagName).toBe('EM')
    expect(screen.getByText('gone').tagName).toBe('S')
    expect(screen.getByRole('link', { name: 'site' }).getAttribute('href')).toBe(
      'https://example.com',
    )
    expect(screen.getByText('first').tagName).toBe('LI')
    expect(screen.getByText('second').tagName).toBe('LI')
  })

  it('renders blockquote, fenced code and inline code', () => {
    const node = markdownRender('> quoted line\n\n```ts\nconst a = 1\n```\n\n`inline`')

    render(React.createElement('div', null, node))

    expect(screen.getByText('quoted line')).toBeTruthy()
    expect(screen.getByText(/const a = 1/).tagName).toBe('CODE')
    expect(screen.getByText('inline').tagName).toBe('CODE')
  })

  it('renders images with sanitized url and degrades invalid links to text', () => {
    const node = markdownRender(
      '![cover](https://img.example.com/a.png) [bad](javascript:alert(1))',
    )

    const { container } = render(React.createElement('div', null, node))

    expect(screen.getByTestId('md-image').getAttribute('src')).toBe('https://img.example.com/a.png')
    expect(screen.queryByRole('link', { name: 'bad' })).toBeNull()
    expect(container.textContent || '').toContain('bad')
  })

  it('returns null for empty markdown', () => {
    expect(markdownRender('')).toBeNull()
  })
})
