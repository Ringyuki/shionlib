import { AppConfig } from '../interfaces/app.interface'
import { AuthConfig } from '../interfaces/auth.interface'
import { DatabaseConfig } from '../interfaces/database.interface'
import { LLMsConfig } from '../interfaces/llms.interface'

export type ConfigType = AppConfig & AuthConfig & DatabaseConfig & LLMsConfig

type IsRecord<T> = T extends object
  ? T extends (...args: unknown[]) => unknown
    ? false
    : T extends readonly unknown[]
      ? false
      : true
  : false

type LeafPaths<T, P extends string = ''> = {
  [K in keyof T & string]: IsRecord<T[K]> extends true ? LeafPaths<T[K], `${P}${K}.`> : `${P}${K}`
}[keyof T & string]

type PathValue<T, P extends string> = P extends `${infer K}.${infer Rest}`
  ? K extends keyof T
    ? PathValue<T[K], Rest>
    : never
  : P extends keyof T
    ? T[P]
    : never

export type ConfigPath = LeafPaths<ConfigType>
export type ConfigPathValue<T extends ConfigPath> = PathValue<ConfigType, T>
