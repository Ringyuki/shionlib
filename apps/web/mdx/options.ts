import { fileURLToPath } from 'node:url'
import type { Options } from '@mdx-js/rollup'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import remarkMdxFrontmatter from 'remark-mdx-frontmatter'
import { pictures } from './pictures.ts'
import { sections } from './sections.ts'

const served = fileURLToPath(new URL('../public', import.meta.url))

export const mdxOptions = {
  remarkPlugins: [remarkFrontmatter, remarkMdxFrontmatter, remarkGfm],
  rehypePlugins: [sections, [pictures, { root: served }]],
} satisfies Options
