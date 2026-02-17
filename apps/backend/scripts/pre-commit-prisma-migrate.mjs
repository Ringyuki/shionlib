#!/usr/bin/env node
import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'

function run(cmd, opts = {}) {
  const result = execSync(cmd, { stdio: 'pipe', encoding: 'utf8', ...opts })
  if (result == null) return ''
  return (typeof result === 'string' ? result : String(result)).trim()
}

function main() {
  const repoRoot = run('git rev-parse --show-toplevel')
  const schemaPath = resolve(repoRoot, 'prisma/schema.prisma')
  if (!existsSync(schemaPath)) {
    console.log('[pre-commit] prisma/schema.prisma not exists, skip migrate check')
    return
  }

  try {
    const headExists = run('git rev-parse --verify HEAD || echo')
    const base = headExists ? 'HEAD' : ''
    const diffFiles = run(`git diff --cached --name-only ${base}`).split('\n').filter(Boolean)
    const schemaChanged = diffFiles.some(f => f === 'prisma/schema.prisma')
    if (!schemaChanged) {
      console.log('[pre-commit] schema not changed, skip auto migrate')
      return
    }
  } catch {
    console.log('[pre-commit] check cached changes failed, skip auto migrate')
    return
  }

  const branch = run('git rev-parse --abbrev-ref HEAD')
  const safeBranch = branch && branch !== 'HEAD' ? branch.replace(/[^a-zA-Z0-9_-]/g, '-') : 'update'
  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  const name = `auto-${safeBranch}-${ts}`

  console.log(`[pre-commit] detect schema changed, generate migration: ${name}`)
  try {
    run('pnpm prisma:generate', { cwd: repoRoot })
    run(`pnpm prisma:migrate --name ${name}`, { cwd: repoRoot, stdio: 'inherit' })
  } catch (e) {
    console.error('[pre-commit] generate migration failed, please fix and try again')
    console.error(String(e?.stdout || e?.message || e))
    process.exit(1)
  }

  // add new migration to commit
  try {
    run('git add prisma/migrations')
    console.log('[pre-commit] add prisma/migrations to commit')
  } catch {
    console.warn('[pre-commit] git add migrations directory failed, please add manually')
  }
}

main()
