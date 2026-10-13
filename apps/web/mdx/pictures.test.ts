import { evaluate } from '@mdx-js/mdx'
import { createElement } from 'react'
import * as runtime from 'react/jsx-runtime'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { mdxOptions } from './options'
import { densityOf, shownSize } from './pictures'

async function rendered(source: string) {
  const page = await evaluate(source, { ...runtime, ...mdxOptions })
  return renderToStaticMarkup(createElement(page.default))
}

describe('shownSize', () => {
  it('reads how dense a picture is from its name', () => {
    expect(densityOf('/assets/images/upload-game-files/zh/upload-page@2x.webp')).toBe(2)
    expect(densityOf('/assets/images/a/b@3x.png')).toBe(3)
    expect(densityOf('/brand/logo.png')).toBe(1)
  })

  it('shows a dense picture at the size of what it pictures', () => {
    expect(shownSize('/a/menu@2x.webp', { width: 641, height: 480 })).toEqual({
      width: 321,
      height: 240,
    })
    expect(shownSize('/a/menu.webp', { width: 641, height: 480 })).toEqual({
      width: 641,
      height: 480,
    })
  })
})

describe('pictures', () => {
  it('gives a picture the size of its file, so the page keeps its place', async () => {
    expect(await rendered('![书音的图书馆](/brand/logo.png)')).toContain(
      '<img src="/brand/logo.png" alt="书音的图书馆" width="128" height="128"/>',
    )
  })

  it('refuses a picture that is not a file of the site', async () => {
    await expect(rendered('![缺少的图片](/assets/images/never/drawn.png)')).rejects.toThrow(
      'The picture /assets/images/never/drawn.png is not a file under public/',
    )
    await expect(rendered('![别处的图片](https://example.com/picture.png)')).rejects.toThrow(
      'The picture https://example.com/picture.png is not a file under public/',
    )
  })
})
