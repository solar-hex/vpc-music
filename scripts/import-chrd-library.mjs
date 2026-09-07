#!/usr/bin/env node
/**
 * import-chrd-library.mjs — Import a folder of legacy .chrd files into a database.
 *
 * Usage:
 *   pnpm import:chrd --dir <path> --org <uuid|name> --dry-run                # development (.env)
 *   pnpm import:chrd staging --dir <path> --org <uuid|name> --dry-run        # staging (.env.staging)
 *   pnpm import:chrd production --dir <path> --org <uuid|name>              # production (.env.production)
 *
 * Other flags: --created-by <email>   --exclude <glob> (repeatable)   --report <dir>
 * The worker (apps/api/src/import-chrd-library.js) runs from apps/api so the
 * API's dependencies, schema and env file resolve; --dir/--report are made
 * absolute here so they stay relative to where you ran the command.
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const apiDir = resolve(__dirname, '../apps/api')

const envAliases = {
  dev: 'development',
  development: 'development',
  stg: 'staging',
  stage: 'staging',
  staging: 'staging',
  prd: 'production',
  prod: 'production',
  production: 'production',
}

const args = process.argv.slice(2)
const rawEnv = args[0] && !args[0].startsWith('--') ? args.shift() : undefined
const env = rawEnv ? (envAliases[rawEnv.toLowerCase()] ?? rawEnv) : undefined
const envFile = env ? `.env.${env}` : '.env'
const envPath = resolve(apiDir, envFile)

if (env && !existsSync(envPath)) {
  console.error(`Error: ${envPath} not found`)
  process.exit(1)
}

const workerArgs = args.map((arg, index) =>
  args[index - 1] === '--dir' || args[index - 1] === '--report' ? resolve(process.cwd(), arg) : arg,
)

console.log(`\nImporting .chrd library into the ${env ?? 'development'} database (${envFile})...\n`)

const result = spawnSync(process.execPath, ['src/import-chrd-library.js', ...workerArgs], {
  stdio: 'inherit',
  cwd: apiDir,
  env: { ...process.env, DOTENV_CONFIG_PATH: envFile, NODE_ENV: env ?? process.env.NODE_ENV ?? 'development' },
})

process.exit(result.status ?? 1)
