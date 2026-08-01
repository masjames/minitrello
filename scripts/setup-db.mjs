import { readFileSync } from 'node:fs'
import { neon } from '@neondatabase/serverless'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL not set')
  process.exit(1)
}
const sql = neon(url)
const file = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8')

// naive split: statements end with ";" at line end
const statements = file
  .split(/;\s*$/m)
  .map((s) => s.trim())
  .filter((s) => s && !s.startsWith('--') === true || /\w/.test(s.replace(/--.*$/gm, '')))
  .map((s) => s.replace(/--.*$/gm, '').trim())
  .filter(Boolean)

for (const stmt of statements) {
  await sql.query(stmt)
  console.log('ok:', stmt.slice(0, 60).replace(/\s+/g, ' '))
}
console.log('done')
