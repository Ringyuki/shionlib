import { evaluate } from '@mdx-js/mdx'
import { createElement } from 'react'
import * as runtime from 'react/jsx-runtime'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { mdxOptions } from './options'
import { anchorOf } from './sections'

function read(source: string) {
  return evaluate(source, { ...runtime, ...mdxOptions })
}

describe('anchorOf', () => {
  it('keeps the anchors the published documents already have', () => {
    expect(anchorOf('校验文件哈希')).toBe('校验文件哈希')
    expect(anchorOf('模拟器引擎（仅 Android / iOS）')).toBe('模拟器引擎仅-android-ios')
    expect(anchorOf('Reading the tags & notes')).toBe('reading-the-tags-and-notes')
    expect(anchorOf('  What is LunaBox?  ')).toBe('what-is-lunabox')
    expect(anchorOf('！？')).toBe('')
  })
})

describe('sections', () => {
  it('gives every heading its anchor and lists the second and third levels', async () => {
    const page = await read(
      [
        '# 生肉食用指南',
        '## 科普部分',
        '### 格式',
        '#### ISO 本质上是什么',
        '### 转区',
        '## 教程部分',
        '## 科普部分',
      ].join('\n\n'),
    )
    expect(page.sections).toEqual([
      {
        id: '科普部分',
        label: '科普部分',
        children: [
          { id: '格式', label: '格式', children: [] },
          { id: '转区', label: '转区', children: [] },
        ],
      },
      { id: '教程部分', label: '教程部分', children: [] },
      { id: '科普部分-1', label: '科普部分', children: [] },
    ])
    const html = renderToStaticMarkup(createElement(page.default))
    expect(html).toContain('<h1 id="生肉食用指南">生肉食用指南</h1>')
    expect(html).toContain('<h4 id="iso-本质上是什么">ISO 本质上是什么</h4>')
  })

  it('lists a third-level heading that has none of the second level above it', async () => {
    const page = await read('### Alone\n\n## After')
    expect(page.sections).toEqual([
      { id: 'alone', label: 'Alone', children: [] },
      { id: 'after', label: 'After', children: [] },
    ])
  })

  it('hands over what the document says about itself', async () => {
    const page = await read('---\ntitle: 如何下载游戏\ndate: 2026-02-27\n---\n\n正文')
    expect(page.frontmatter).toMatchObject({ title: '如何下载游戏' })
    expect(renderToStaticMarkup(createElement(page.default))).toBe('<p>正文</p>')
  })
})
