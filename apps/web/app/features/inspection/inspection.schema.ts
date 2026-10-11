import * as v from 'valibot'
import { maxQueryLength } from './inspection'

const id = v.pipe(v.string(), v.toNumber(), v.safeInteger(), v.minValue(1))

const query = v.fallback(
  v.pipe(
    v.nullable(v.string(), ''),
    v.trim(),
    v.transform(text => text.slice(0, maxQueryLength)),
  ),
  '',
)

const wantedPage = v.object({
  inspectionId: id,
  parent: v.nullable(id),
  page: v.fallback(id, 1),
  query,
})

const wantedView = v.object({
  file: v.fallback(v.nullable(id), null),
  query,
})

export type WantedPage = v.InferOutput<typeof wantedPage>

export type WantedView = v.InferOutput<typeof wantedView>

export function wantedPageFrom(params: URLSearchParams): WantedPage | undefined {
  const parsed = v.safeParse(wantedPage, {
    inspectionId: params.get('inspection'),
    parent: params.get('parent'),
    page: params.get('page'),
    query: params.get('q'),
  })
  return parsed.success ? parsed.output : undefined
}

export function entryIdFrom(params: URLSearchParams): number | undefined {
  const parsed = v.safeParse(id, params.get('entry'))
  return parsed.success ? parsed.output : undefined
}

export function wantedViewFrom(params: URLSearchParams): WantedView {
  return v.parse(wantedView, { file: params.get('file'), query: params.get('q') })
}
