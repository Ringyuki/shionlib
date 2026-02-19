import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getDirectoryTree } from '../../../../libs/docs/directoryTree'

type TreeNode = {
  path: string
  label?: string
  name: string
  type: 'file' | 'directory'
  children?: TreeNode[]
}

const writeFile = (root: string, relativePath: string, contents: string) => {
  const filePath = path.join(root, relativePath)
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, contents)
}

const collectPaths = (node: TreeNode): string[] => {
  const current = [`${node.type}:${node.path}`]
  if (!node.children) return current
  return current.concat(node.children.flatMap(child => collectPaths(child)))
}

describe('libs/docs/directoryTree (unit)', () => {
  let previousCwd = ''
  let sandbox = ''

  beforeEach(() => {
    previousCwd = process.cwd()
    sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'shionlib-doc-tree-'))
    process.chdir(sandbox)
  })

  afterEach(() => {
    process.chdir(previousCwd)
    fs.rmSync(sandbox, { recursive: true, force: true })
  })

  it('builds directory tree from localized contents when locale directory exists', () => {
    writeFile(sandbox, 'contents/zh/intro.mdx', '---\ntitle: 中文介绍\n---\n\n# intro')
    writeFile(sandbox, 'contents/zh/guides/topic.mdx', '---\ntitle: 深入指南\n---\n\nbody')
    writeFile(sandbox, 'contents/zh/ignored.txt', 'ignore me')

    const tree = getDirectoryTree('zh') as TreeNode
    const allPaths = collectPaths(tree)

    expect(tree.type).toBe('directory')
    expect(allPaths).toContain('file:intro')
    expect(allPaths).toContain('file:guides/topic')
    expect(allPaths).not.toContain('file:ignored')

    const intro = tree.children?.find(child => child.path === 'intro')
    expect(intro?.label).toBe('中文介绍')
  })

  it('falls back to default contents root when locale directory does not exist', () => {
    writeFile(sandbox, 'contents/getting-started.mdx', '---\ntitle: Start\n---\n\nhello')
    writeFile(sandbox, 'contents/zh/only-zh.mdx', '---\ntitle: zh\n---\n\nzh')

    const tree = getDirectoryTree('ja') as TreeNode
    const allPaths = collectPaths(tree)

    expect(allPaths).toContain('file:getting-started')
    expect(allPaths).not.toContain('file:only-zh')
  })
})
