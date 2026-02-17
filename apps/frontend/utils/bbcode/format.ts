export interface BBCodeOptions {
  newlineToBr: boolean
  spoilerClass: string
  maskClass: string
}

export default function bbcodeToHtml(input: unknown, options: Partial<BBCodeOptions> = {}): string {
  const opts: BBCodeOptions = {
    newlineToBr: true,
    spoilerClass:
      'text-black dark:text-white bg-black dark:bg-white hover:text-white/80 dark:hover:text-black/80 transition-all duration-200',
    maskClass:
      'text-black dark:text-white bg-black dark:bg-white hover:text-white/80 dark:hover:text-black/80 transition-all duration-200',
    ...options,
  }

  let text = String(input ?? '')

  const escapeHtml = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')

  const escapeAttr = (s: string) => String(s).replace(/"/g, '&quot;').replace(/</g, '&lt;')

  const replaceNested = (str: string, regex: RegExp, replacer: (...args: any[]) => string) => {
    let prev: string
    let out = str
    do {
      prev = out
      out = out.replace(regex, replacer)
    } while (out !== prev)
    return out
  }

  const sanitizeUrl = (u: string): string | null => {
    const url = String(u).trim()
    if (/^(https?:|mailto:|tel:|\/)/i.test(url)) {
      try {
        return url.replace(/\s+/g, '')
      } catch {
        return null
      }
    }
    return null
  }

  const sanitizeImageUrl = (u: string): string | null => {
    const safe = sanitizeUrl(u)
    if (!safe) return null
    // if (!/\.(png|jpe?g|gif|webp|bmp|svg)(\?|#|$)/i.test(safe)) return null;
    return safe
  }

  const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))

  const sanitizeColor = (c: string): string | null => {
    const s = String(c).trim()
    return /^#([0-9a-f]{3,8})$/i.test(s) ? s : null
  }

  text = escapeHtml(text)

  const codeStore: string[] = []
  text = replaceNested(text, /\[code\]([\s\S]*?)\[\/code\]/gi, (_m, body: string) => {
    const idx = codeStore.push(body) - 1
    return `__CODEBLOCK_${idx}__`
  })

  const listRegex = /\[list(?:=(1))?\]([\s\S]*?)\[\/list\]/gi
  text = replaceNested(text, listRegex, (_m, orderedFlag: string, content: string) => {
    const parts = content.split(/\[\*\]/g)
    const startsWithItem = /^\s*\[\*\]/.test(content)
    const items = parts
      .map(s => s.trim())
      .filter((s, i) => (startsWithItem ? s.length : i > 0 && s.length))
    if (!items.length) return content

    const tag = orderedFlag === '1' ? 'ol' : 'ul'
    return `<${tag}>${items.map(li => `<li>${li}</li>`).join('')}</${tag}>`
  })

  text = replaceNested(
    text,
    /\[b\]([\s\S]*?)\[\/b\]/gi,
    (_m, c: string) => `<span class="font-bold">${c}</span>`,
  )
  text = replaceNested(text, /\[i\]([\s\S]*?)\[\/i\]/gi, (_m, c: string) => `<em>${c}</em>`)
  text = replaceNested(text, /\[u\]([\s\S]*?)\[\/u\]/gi, (_m, c: string) => `<u>${c}</u>`)
  text = replaceNested(text, /\[s\]([\s\S]*?)\[\/s\]/gi, (_m, c: string) => `<s>${c}</s>`)

  text = replaceNested(
    text,
    /\[quote\]([\s\S]*?)\[\/quote\]/gi,
    (_m, c: string) => `<blockquote>${c}</blockquote>`,
  )

  text = replaceNested(
    text,
    /\[spoiler\]([\s\S]*?)\[\/spoiler\]/gi,
    (_m, c: string) =>
      `<span data-spoiler="true" class="${escapeAttr(opts.spoilerClass)}">${c}</span>`,
  )
  text = replaceNested(
    text,
    /\[mask\]([\s\S]*?)\[\/mask\]/gi,
    (_m, c: string) => `<span data-mask="true" class="${escapeAttr(opts.maskClass)}">${c}</span>`,
  )

  text = replaceNested(
    text,
    /\[color=([#a-z0-9]+)\]([\s\S]*?)\[\/color\]/gi,
    (_m, color: string, c: string) => {
      const safe = sanitizeColor(color)
      return safe ? `<span style="color:${safe}">${c}</span>` : c
    },
  )

  text = replaceNested(
    text,
    /\[size=(\d{1,3})\]([\s\S]*?)\[\/size\]/gi,
    (_m, n: string, c: string) => {
      const px = clamp(parseInt(n, 10), 8, 64)
      return `<span style="font-size:${px}px">${c}</span>`
    },
  )

  // [url]href[/url]
  text = replaceNested(text, /\[url\]([\s\S]*?)\[\/url\]/gi, (_m, href: string) => {
    const safe = sanitizeUrl(href)
    return safe
      ? `<a class="bbcode-url" href="${escapeAttr(safe)}" target="_blank" rel="nofollow noopener">${href}</a>`
      : href
  })

  // [url=href]label[/url]
  text = replaceNested(
    text,
    /\[url=([^\]]+?)\]([\s\S]*?)\[\/url\]/gi,
    (_m, href: string, label: string) => {
      const safe = sanitizeUrl(href)
      return safe
        ? `<a class="bbcode-url" href="${escapeAttr(safe)}" target="_blank" rel="nofollow noopener">${label}</a>`
        : label
    },
  )

  // [img]src[/img]
  text = replaceNested(text, /\[img\]([\s\S]*?)\[\/img\]/gi, (_m, src: string) => {
    const safe = sanitizeImageUrl(src)
    return safe ? `<img src="${escapeAttr(safe)}" alt="" loading="lazy" />` : src
  })

  if (opts.newlineToBr) {
    text = text.replace(/\r?\n/g, '<br />')
  }

  text = text.replace(/__CODEBLOCK_(\d+)__/g, (_m, i: string) => {
    const raw = codeStore[Number(i)] ?? ''
    return `<pre><code>${raw}</code></pre>`
  })

  return text
}
