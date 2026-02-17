export interface DocsMetadata {
  title: string
  banner: string
  description: string
  text_count: number
  slug: string
  date: string
}

export interface DocsFrontmatter {
  title: string
  banner: string
  description: string
  date: string
  author_uid: number
  author_name: string
  author_avatar: string
}

export interface Doc {
  slug: string
  content: string
  frontmatter: DocsFrontmatter
}
