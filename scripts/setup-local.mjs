import { randomBytes } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'

const example = await readFile(new URL('../.env.example', import.meta.url), 'utf8')
const environment = example.replace('replace-with-at-least-32-random-characters', randomBytes(32).toString('hex'))
try {
  await writeFile(new URL('../.env.local', import.meta.url), environment, { flag: 'wx', mode: 0o600 })
  console.log('✓ .env.local criado com segredo de autenticação exclusivo.')
} catch (error) {
  if (error.code !== 'EEXIST') throw error
  console.log('.env.local já existe; configuração preservada. Confira as variáveis locais no README.')
}
