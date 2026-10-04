import type {
  HttpMethod,
  PathsWithMethod,
  RequestBodyJSON,
  SuccessResponseJSON,
} from 'openapi-typescript-helpers'
import type { BusinessCode } from './generated/business-codes'
import type { components, paths } from './generated/openapi'

export type Schema<Name extends keyof components['schemas']> = components['schemas'][Name]

export type ApiPath<Method extends HttpMethod> = PathsWithMethod<paths, Method>

type Operation<Path extends ApiPath<Method>, Method extends HttpMethod> = NonNullable<
  paths[Path][Method]
>

export type ApiData<Path extends ApiPath<Method>, Method extends HttpMethod> =
  SuccessResponseJSON<Operation<Path, Method>> extends { data: infer Data } ? Data : undefined

export type ApiBody<Path extends ApiPath<Method>, Method extends HttpMethod> = RequestBodyJSON<
  Operation<Path, Method>
>

export type ApiQuery<Path extends ApiPath<Method>, Method extends HttpMethod> =
  Operation<Path, Method> extends { parameters: { query?: infer Query } }
    ? NonNullable<Query>
    : never

export type ApiFailure = Schema<'ErrorResponse'>

export type BusinessCodeName = keyof typeof BusinessCode
