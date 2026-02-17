import { ImageResponse } from 'next/og'
import { makeETag } from './_utils/make-etag'
import { defalutTitleMap, defaultDescriptionMap } from './_constants/maps'
import { W, H, SAFE, GAP, baseUrl } from './_constants/constants'

export const runtime = 'edge'
export const contentType = 'image/png'

const cinzelPromise = fetch(new URL('_assets/fonts/Cinzel-Bold.ttf', import.meta.url), {
  cache: 'force-cache',
}).then(r => r.arrayBuffer())
const notoSansPromise = fetch(new URL('_assets/fonts/NotoSans-Regular.ttf', import.meta.url), {
  cache: 'force-cache',
}).then(r => r.arrayBuffer())

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)

  const locale = searchParams.get('l') || 'en'
  const aspectRatio = (searchParams.get('ar') || '1:1') as '3:2' | '2:3' | '1:1'
  const title = searchParams.get('t') || defalutTitleMap[locale as keyof typeof defalutTitleMap]
  const description =
    searchParams.get('d') || defaultDescriptionMap[locale as keyof typeof defaultDescriptionMap]
  const imageUrl = searchParams.get('i')

  const etag = await makeETag([aspectRatio, title, description, imageUrl].join('|'))

  if (req.headers.get('if-none-match') === etag) {
    return new Response(null, {
      status: 304,
      headers: { 'cache-control': 'public, max-age=604800' },
    })
  }

  const image = imageUrl ? new URL(`/og/to-png?u=${imageUrl}`, baseUrl).toString() : undefined
  const fallbackImageUrl = new URL('/assets/images/aecrf-s388z.png', baseUrl).toString()

  const [cinzelBold, notoSans] = await Promise.all([cinzelPromise, notoSansPromise])

  const imageBox =
    aspectRatio === '3:2'
      ? { w: 500, h: Math.round((500 * 2) / 3) }
      : { w: Math.round(Math.round((500 * 2) / 3) / 1.5), h: Math.round((500 * 2) / 3) }

  const textColWidth = W - SAFE * 2 - (imageBox.w + GAP)
  const webkitLineClamp = aspectRatio === '1:1' ? 3 : aspectRatio === '3:2' ? 6 : 4

  const bodyFamily = notoSans ? 'NotoSans' : undefined

  const res = new ImageResponse(
    (
      <div
        style={{
          width: W,
          height: H,
          padding: SAFE,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          background: 'linear-gradient(135deg, #0f172a 0%, #111827 50%, #1f2937 100%)',
          color: '#e5e7eb',
        }}
      >
        <div
          style={{
            fontFamily: 'Cinzel',
            fontSize: 48,
            color: '#f9fafb',
          }}
        >
          Shionlib
        </div>
        <div
          style={{
            display: 'flex',
            gap: aspectRatio === '1:1' ? 0 : GAP,
            boxSizing: 'border-box',
            alignItems: 'flex-start',
            width: '100%',
            justifyContent: 'space-between',
          }}
        >
          <div
            style={{
              width: aspectRatio === '1:1' ? 550 : textColWidth,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                display: '-webkit-box',
                wordBreak: 'break-word',
                whiteSpace: 'pre-wrap',
                overflowWrap: 'break-word',
                textOverflow: 'ellipsis',
                WebkitLineClamp: 1,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                fontSize: aspectRatio === '3:2' ? 56 : 72,
                fontWeight: 700,
                color: '#f9fafb',
                textShadow: '0 2px 12px rgba(0,0,0,0.35)',
                marginBottom: description ? (aspectRatio === '3:2' ? 16 : 20) : 0,
                maxWidth: aspectRatio === '1:1' ? 550 : textColWidth,
              }}
            >
              {title}
            </div>

            {description ? (
              <div
                style={{
                  display: '-webkit-box',
                  wordBreak: 'break-word',
                  whiteSpace: 'pre-wrap',
                  overflowWrap: 'break-word',
                  textOverflow: 'ellipsis',
                  WebkitLineClamp: webkitLineClamp,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  ...(bodyFamily ? { fontFamily: bodyFamily } : null),
                  fontSize: aspectRatio === '3:2' ? 24 : 32,
                  lineHeight: 1.35,
                  color: '#d1d5db',
                  opacity: 0.95,
                  maxWidth: aspectRatio === '1:1' ? 550 : textColWidth,
                }}
              >
                {description}
              </div>
            ) : null}
          </div>
          {image && aspectRatio !== '1:1' ? (
            <div
              style={{
                display: 'flex',
                width: imageBox.w,
                height: imageBox.h,
                alignSelf: aspectRatio === '3:2' ? 'center' : 'flex-start',
                borderRadius: 20,
                overflow: 'hidden',
                boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
                background: 'rgba(255,255,255,0.04)',
              }}
            >
              <img
                src={image}
                width={imageBox.w}
                height={imageBox.h}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                width: 300,
                height: 300,
                overflow: 'hidden',
              }}
            >
              <img
                src={image || fallbackImageUrl}
                style={{ width: '100%', height: '100%', objectFit: 'cover', overflow: 'hidden' }}
              />
            </div>
          )}
        </div>
        <div
          style={{
            fontSize: 16,
            color: '#9ca3af',
            alignSelf: 'flex-end',
          }}
        >
          A Visual Novel/Galgame Archive
        </div>
      </div>
    ),
    {
      width: W,
      height: H,
      emoji: 'noto',
      headers: {
        'cache-control': 'public, max-age=604800',
      },
      fonts: [
        { name: 'NotoSans', data: notoSans },
        { name: 'Cinzel', data: cinzelBold },
      ],
    },
  )

  res.headers.set('ETag', etag)
  return res
}
