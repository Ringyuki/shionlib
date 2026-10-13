import { Blockquote, cn, Link, Spoiler, Text } from '@hina-ui/react'
import { useMemo, type ComponentProps } from 'react'
import { parseBBCode, type BBCodeNode } from '~/shared/markup/bbcode'

type TextProps = ComponentProps<typeof Text>
type Tone = NonNullable<TextProps['tone']>
type Inherited = { tone: Tone; bold: boolean }

const phrases = { bold: 'strong', italic: 'em', underline: 'u', strike: 's' } as const

type BBCodeTextProps = {
  source: string
  size?: TextProps['size']
  tone?: Tone
  className?: string
}

export function BBCodeText({ source, size, tone = 'default', className }: BBCodeTextProps) {
  const nodes = useMemo(() => parseBBCode(source), [source])
  return (
    <Text
      as="div"
      size={size}
      tone={tone}
      className={cn('break-words whitespace-pre-line', className)}
    >
      <Markup nodes={nodes} inherited={{ tone, bold: false }} />
    </Text>
  )
}

function Markup({ nodes, inherited }: { nodes: readonly BBCodeNode[]; inherited: Inherited }) {
  return nodes.map((node, index) => <MarkupNode key={index} node={node} inherited={inherited} />)
}

function MarkupNode({ node, inherited }: { node: BBCodeNode; inherited: Inherited }) {
  if (node.kind === 'text') {
    return node.text
  }
  if (node.kind === 'link') {
    return (
      <Link href={node.href} target="_blank" rel="noopener noreferrer nofollow ugc" underline>
        <Markup nodes={node.children} inherited={{ ...inherited, tone: 'accent' }} />
      </Link>
    )
  }
  if (node.style === 'quote') {
    return (
      <Blockquote>
        <Markup nodes={node.children} inherited={{ ...inherited, tone: 'muted' }} />
      </Blockquote>
    )
  }
  if (node.style === 'spoiler') {
    return (
      <Spoiler>
        <Markup nodes={node.children} inherited={inherited} />
      </Spoiler>
    )
  }
  const bold = inherited.bold || node.style === 'bold'
  return (
    <Text
      as={phrases[node.style]}
      size="inherit"
      tone={inherited.tone}
      weight={bold ? 'semibold' : 'normal'}
    >
      <Markup nodes={node.children} inherited={{ ...inherited, bold }} />
    </Text>
  )
}
