import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const messagesRoot = path.resolve(process.cwd(), 'messages')

function listLocaleDirs(root) {
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort()
}

function listJsonFiles(dir, relativeBase = dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...listJsonFiles(fullPath, relativeBase))
      continue
    }
    if (entry.isFile() && entry.name.endsWith('.json')) {
      files.push(path.relative(relativeBase, fullPath))
    }
  }
  return files.sort()
}

function setNested(target, keys, value) {
  let cursor = target
  for (let i = 0; i < keys.length - 1; i += 1) {
    const key = keys[i]
    cursor[key] ??= {}
    cursor = cursor[key]
  }
  cursor[keys.at(-1)] = value
}

function loadLocaleMessages(locale) {
  const localeDir = path.join(messagesRoot, locale)
  const files = listJsonFiles(localeDir)
  const result = {}

  for (const relativePath of files) {
    const filePath = path.join(localeDir, relativePath)
    const json = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    const segments = relativePath
      .replace(/\.json$/u, '')
      .split(path.sep)
      .filter(Boolean)

    if (segments.at(-1) === 'index') {
      segments.pop()
    }
    if (segments.length === 0) {
      if (json && typeof json === 'object' && !Array.isArray(json)) {
        Object.assign(result, json)
      }
      continue
    }

    setNested(result, segments, json)
  }

  return result
}

function flattenLeaves(value, prefix = '') {
  if (typeof value === 'string') return [{ key: prefix, value }]
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
    return [{ key: prefix, value: String(value) }]
  }
  if (Array.isArray(value)) {
    return [{ key: prefix, value }]
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) =>
      flattenLeaves(v, prefix ? `${prefix}.${k}` : k),
    )
  }
  return []
}

function extractPlaceholders(message) {
  const placeholders = new Set()
  const regex = /\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*(?=[,}])/gu
  for (const match of message.matchAll(regex)) {
    placeholders.add(match[1])
  }
  return placeholders
}

function formatSet(set) {
  return [...set].sort().join(', ')
}

const locales = listLocaleDirs(messagesRoot)
if (locales.length < 2) {
  console.error('Expected at least 2 locale directories under messages/.')
  process.exit(1)
}

const baseLocale = locales.includes('en') ? 'en' : locales[0]
const localeData = Object.fromEntries(locales.map(locale => [locale, loadLocaleMessages(locale)]))
const flattened = Object.fromEntries(
  locales.map(locale => [
    locale,
    new Map(flattenLeaves(localeData[locale]).map(item => [item.key, item.value])),
  ]),
)

let hasError = false
let hasWarning = false

for (const locale of locales) {
  if (locale === baseLocale) continue

  const baseMap = flattened[baseLocale]
  const targetMap = flattened[locale]
  const missingInTarget = [...baseMap.keys()].filter(key => !targetMap.has(key))
  const extraInTarget = [...targetMap.keys()].filter(key => !baseMap.has(key))

  if (missingInTarget.length > 0 || extraInTarget.length > 0) {
    hasError = true
    console.error(`\n[${baseLocale} -> ${locale}] Key mismatch`)
    if (missingInTarget.length > 0) {
      console.error(`  Missing in ${locale} (${missingInTarget.length}):`)
      for (const key of missingInTarget.slice(0, 20)) console.error(`    - ${key}`)
      if (missingInTarget.length > 20)
        console.error(`    ...and ${missingInTarget.length - 20} more`)
    }
    if (extraInTarget.length > 0) {
      console.error(`  Extra in ${locale} (${extraInTarget.length}):`)
      for (const key of extraInTarget.slice(0, 20)) console.error(`    - ${key}`)
      if (extraInTarget.length > 20) console.error(`    ...and ${extraInTarget.length - 20} more`)
    }
  }

  const sharedKeys = [...baseMap.keys()].filter(key => targetMap.has(key))
  const placeholderMismatches = []
  for (const key of sharedKeys) {
    const baseValue = baseMap.get(key)
    const targetValue = targetMap.get(key)
    if (typeof baseValue !== 'string' || typeof targetValue !== 'string') continue

    const basePlaceholders = extractPlaceholders(baseValue)
    const targetPlaceholders = extractPlaceholders(targetValue)
    if (formatSet(basePlaceholders) !== formatSet(targetPlaceholders)) {
      placeholderMismatches.push({
        key,
        base: basePlaceholders,
        target: targetPlaceholders,
      })
    }
  }

  if (placeholderMismatches.length > 0) {
    hasWarning = true
    console.warn(
      `\n[${baseLocale} -> ${locale}] Placeholder mismatch (${placeholderMismatches.length})`,
    )
    for (const item of placeholderMismatches.slice(0, 20)) {
      console.warn(
        `  - ${item.key} | ${baseLocale}: {${formatSet(item.base)}} | ${locale}: {${formatSet(item.target)}}`,
      )
    }
    if (placeholderMismatches.length > 20) {
      console.warn(`    ...and ${placeholderMismatches.length - 20} more`)
    }
  }
}

if (hasError) {
  process.exit(1)
}

const totalKeys = flattened[baseLocale].size
console.log(
  `i18n check passed: ${locales.join(', ')} (${totalKeys} leaf keys, base: ${baseLocale})`,
)
if (hasWarning) {
  console.warn('i18n placeholder mismatches found (warnings only).')
}
