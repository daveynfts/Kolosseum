import { readFile, readdir } from 'node:fs/promises'
import { config as loadEnv } from 'dotenv'
import { getPool } from '../../lib/research/db'

loadEnv({ path: '.env.local', quiet: true })
const db = getPool()
try {
  const folder = new URL('../../dr_migrations/', import.meta.url)
  for (const file of (await readdir(folder)).filter(f => /^\d+.*\.sql$/.test(f)).sort()) {
    await db.query(await readFile(new URL(file, folder), 'utf8'))
    process.stdout.write(`Applied ${file}.\n`)
  }
} finally {
  await db.end()
}
