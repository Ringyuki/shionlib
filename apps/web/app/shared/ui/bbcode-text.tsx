import { Blockquote, cn, Heading, Link, List, ListItem, Spoiler, Text } from '@hina-ui/react'
import { useMemo, type ComponentProps } from 'react'
import { bbcodeSections, parseBBCode, type BBCodeNode } from '~/shared/markup/bbcode'

type TextProps = ComponentProps<typeof Text>
type Tone = NonNullable<TextProps['tone']>
type Inherited = { tone: Tone; bold: boolean; anchors: ReadonlyMap<BBCodeNode, string> }

const phrases = { bold: 'strong', italic: 'em', underline: 'u', strike: 's' } as const

type BBCodeTextProps = {
  source: string
  size?: TextProps['size']
  tone?: Tone
  className?: string
}

export function BBCodeText({ source, size, tone = 'default', className }: BBCodeTextProps) {
  const nodes = useMemo(() => parseBBCode(source), [source])
  const anchors = useMemo(() => {
    const sections = bbcodeSections(nodes)
    const titled = nodes.filter(node => node.kind === 'heading')
    return new Map(titled.map((node, index) => [node, sections[index]?.id ?? '']))
  }, [nodes])
  return (
    <Text
      as="div"
      size={size}
      tone={tone}
      className={cn('break-words whitespace-pre-line', className)}
    >
      <Markup nodes={nodes} inherited={{ tone, bold: false, anchors }} />
    </Text>
  )
}

function Markup({ nodes, inherited }: { nodes: readonly BBCodeNode[]; inherited: Inherited }) {
  return nodes.map((node, index) => (
    <MarkupNode key={index} node={node} leading={index === 0} inherited={inherited} />
  ))
}

type MarkupNodeProps = { node: BBCodeNode; leading: boolean; inherited: Inherited }

function MarkupNode({ node, leading, inherited }: MarkupNodeProps) {
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
  if (node.kind === 'heading') {
    return (
      <Heading
        level={node.level}
        id={inherited.anchors.get(node)}
        className={cn('mb-2 scroll-mt-20', leading ? 'mt-0' : 'mt-6')}
      >
        <Markup nodes={node.children} inherited={inherited} />
      </Heading>
    )
  }
  if (node.kind === 'list') {
    return (
      <List ordered={node.ordered} className="my-2">
        {node.items.map((item, index) => (
          <ListItem key={index}>
            <Markup nodes={item} inherited={inherited} />
          </ListItem>
        ))}
      </List>
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
