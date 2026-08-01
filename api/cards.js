import { neon } from '@neondatabase/serverless'

let _sql
function getSql() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL env var is not set on this deployment')
  }
  if (!_sql) _sql = neon(process.env.DATABASE_URL)
  return _sql
}

async function readBody(req) {
  if (req.body) return typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {}
}

export default async function handler(req, res) {
  try {
    const sql = getSql()

    if (req.method === 'GET') {
      const rows = await sql`SELECT id, col, text, position FROM cards ORDER BY position ASC`
      return res.status(200).json(rows)
    }

    if (req.method === 'POST') {
      const { id, col, text, position } = await readBody(req)
      if (!col || !text) return res.status(400).json({ error: 'col and text required' })
      await sql`
        INSERT INTO cards (id, col, text, position)
        VALUES (${id}, ${col}, ${text}, ${position})
      `
      return res.status(201).json({ ok: true })
    }

    if (req.method === 'PUT') {
      // bulk replace the whole board (used by paste-to-import)
      const { cards } = await readBody(req)
      if (!Array.isArray(cards)) return res.status(400).json({ error: 'cards array required' })
      await sql`DELETE FROM cards`
      for (const c of cards) {
        await sql`
          INSERT INTO cards (id, col, text, position)
          VALUES (${c.id}, ${c.col}, ${c.text}, ${c.position})
        `
      }
      return res.status(200).json({ ok: true, count: cards.length })
    }

    if (req.method === 'PATCH') {
      const { id, col, text, position } = await readBody(req)
      if (!id) return res.status(400).json({ error: 'id required' })
      await sql`
        UPDATE cards
        SET col = COALESCE(${col ?? null}, col),
            text = COALESCE(${text ?? null}, text),
            position = COALESCE(${position ?? null}, position)
        WHERE id = ${id}
      `
      return res.status(200).json({ ok: true })
    }

    if (req.method === 'DELETE') {
      const id = req.query?.id
      if (!id) return res.status(400).json({ error: 'id required' })
      await sql`DELETE FROM cards WHERE id = ${id}`
      return res.status(200).json({ ok: true })
    }

    res.setHeader('Allow', 'GET, POST, PUT, PATCH, DELETE')
    return res.status(405).json({ error: 'method not allowed' })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: String(err?.message || err) })
  }
}
