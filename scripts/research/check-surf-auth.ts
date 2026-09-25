import { config as loadEnv } from 'dotenv'
import { checkSurfAuth } from '../../lib/research/surfAuth'

loadEnv({ path: '.env.local', quiet: true })
const status = await checkSurfAuth()
if (status === 'valid') {
  process.stdout.write('Surf API key accepted by the authenticated balance endpoint.\n')
} else if (status === 'invalid') {
  process.stderr.write('Surf rejected SURF_API_KEY (HTTP 401). Generate a new key in the Surf console, update .env.local, and retry. Do not paste the key into chat or logs.\n')
  process.exitCode = 1
} else if (status === 'no-credits') {
  process.stderr.write('Surf accepted the key but reports insufficient credits (HTTP 402).\n')
  process.exitCode = 1
} else {
  process.stderr.write(status === 'missing' ? 'SURF_API_KEY is missing.\n' : 'Surf authentication could not be checked; retry when its gateway is reachable.\n')
  process.exitCode = 1
}