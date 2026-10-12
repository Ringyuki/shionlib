import type { Program } from 'estree'
import { valueToEstree } from 'estree-util-value-to-estree'
import type { Root } from 'hast'
import { toString } from 'hast-util-to-string'
import type {} from 'mdast-util-mdxjs-esm'
import { visit } from 'unist-util-visit'

export type Section = {
  id: string
  label: string
  children: Section[]
}

const headings = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']

export function anchorOf(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/&/g, '-and-')
    .replace(/[^\p{L}\p{N}-]+/gu, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
}

function exported(name: string, value: unknown): Program {
  return {
    type: 'Program',
    sourceType: 'module',
    body: [
      {
        type: 'ExportNamedDeclaration',
        specifiers: [],
        attributes: [],
        source: null,
        declaration: {
          type: 'VariableDeclaration',
          kind: 'const',
          declarations: [
            {
              type: 'VariableDeclarator',
              id: { type: 'Identifier', name },
              init: valueToEstree(value),
            },
          ],
        },
      },
    ],
  }
}

export function sections() {
  return (tree: Root) => {
    const found: Section[] = []
    const taken = new Map<string, number>()
    visit(tree, 'element', heading => {
      if (!headings.includes(heading.tagName)) {
        return
      }
      const label = toString(heading).trim()
      const anchor = anchorOf(label)
      if (anchor === '') {
        return
      }
      const earlier = taken.get(anchor) ?? 0
      taken.set(anchor, earlier + 1)
      const id = earlier === 0 ? anchor : `${anchor}-${earlier}`
      heading.properties.id = id
      if (heading.tagName === 'h2') {
        found.push({ id, label, children: [] })
      }
      if (heading.tagName === 'h3') {
        const under = found.at(-1)?.children ?? found
        under.push({ id, label, children: [] })
      }
    })
    tree.children.unshift({
      type: 'mdxjsEsm',
      value: '',
      data: { estree: exported('sections', found) },
    })
  }
}
