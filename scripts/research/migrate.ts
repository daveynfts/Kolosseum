import { readFile } from 'node:fs/promises'
import { config as loadEnv } from 'dotenv'
import { getPool } from '../../lib/research/db'

loadEnv({ path: '.env.local', quiet: true })
const migration = await readFile(new URL('../../dr_migrations/0001_deep_research.sql', import.meta.url), 'utf8')
const db = getPool()
try {
  await db.query(migration)
  process.stdout.write('Applied dr_ migration and seeded three templates.\n')
} finally {
  await db.end()
}
