import { MDXRemote, MDXRemoteProps } from 'next-mdx-remote/rsc'
import { H } from './elements/H'
import { A } from './elements/A'
import { Img } from './elements/Img'

const components = {
  h1: H(1),
  h2: H(2),
  h3: H(3),
  h4: H(4),
  h5: H(5),
  h6: H(6),
  a: A,
  img: Img,
}

export const Mdx = (props: MDXRemoteProps) => {
  return <MDXRemote {...props} components={{ ...components, ...(props.components || {}) }} />
}
