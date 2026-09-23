import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { config as loadEnv } from 'dotenv'

loadEnv({ path: '.env.local', quiet: true })

const names = ['SURF_API_KEY', 'DATABASE_URL', 'REPORT_ENC_KEY', 'ADMIN_TOKEN'] as const
const secrets: Array<{ name: string; value: string }> = names.flatMap((name) => {
  const value = process.env[name]
  return value && value.length >= 16 ? [{ name, value }] : []
})

if (process.env.OPERATOR_KEYPAIR_PATH) {
  const key = await readFile(process.env.OPERATOR_KEYPAIR_PATH, 'utf8')
  secrets.push({ name: 'OPERATOR_KEYPAIR', value: key })
}

async function filesUnder(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const children = await Promise.all(entries.map((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? filesUnder(path) : Promise.resolve([path])
  }))
  return children.flat()
}

const files = await filesUnder('dist')
const leaks: string[] = []
for (const path of files) {
  const content = await readFile(path)
  for (const secret of secrets) {
    if (content.includes(Buffer.from(secret.value, 'utf8'))) leaks.push(`${secret.name} in ${path}`)
  }
}
if (leaks.length) {
  process.stderr.write(`Client bundle contains configured secret(s): ${leaks.join(', ')}\n`)
  process.exitCode = 1
} else {
  process.stdout.write(`No configured secrets found in dist (${secrets.length} secrets, ${files.length} files checked).\n`)
}
