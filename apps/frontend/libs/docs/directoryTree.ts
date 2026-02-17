import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import type { TreeNode } from '@/interfaces/contents/tree-node.interface'

const getDocsRoot = (locale?: string) => {
  const base = path.join(process.cwd(), 'contents')
  if (locale) {
    const localized = path.join(base, locale)
    if (fs.existsSync(localized) && fs.statSync(localized).isDirectory()) {
      return localized
    }
  }
  return base
}

export const getDirectoryTree = (locale?: string): TreeNode => {
  const buildTree = (currentPath: string, baseName: string): TreeNode | null => {
    const stats = fs.statSync(currentPath)

    if (stats.isFile() && currentPath.endsWith('.mdx')) {
      const fileContents = fs.readFileSync(currentPath, 'utf8')
      const { data } = matter(fileContents)

      return {
        name: baseName.replace(/\.mdx$/, ''),
        label: data.title,
        path: path
          .relative(getDocsRoot(locale), currentPath)
          .replace(/\.mdx$/, '')
          .replace(/\\/g, '/'),
        type: 'file',
      }
    }

    if (stats.isDirectory()) {
      const children = fs
        .readdirSync(currentPath)
        .map(child => buildTree(path.join(currentPath, child), child))
        .filter((child): child is TreeNode => child !== null)

      return {
        name: baseName,
        label: baseName,
        path: path.relative(getDocsRoot(locale), currentPath).replace(/\\/g, '/'),
        children,
        type: 'directory',
      }
    }

    return null
  }

  return buildTree(getDocsRoot(locale), 'contents') as TreeNode
}
