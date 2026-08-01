import { defineConfig, loadEnv } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// Serves the Vercel /api function during `npm run dev` (plain vite doesn't).
// Production uses Vercel's serverless runtime for /api automatically.
function apiDev() {
  return {
    name: 'api-dev',
    configureServer(server) {
      const env = loadEnv(server.config.mode, process.cwd(), '')
      if (env.DATABASE_URL) process.env.DATABASE_URL = env.DATABASE_URL

      server.middlewares.use('/api/cards', async (req, res) => {
        try {
          const url = new URL(req.url, 'http://localhost')
          req.query = Object.fromEntries(url.searchParams)
          const { default: handler } = await server.ssrLoadModule('/api/cards.js')
          res.status = (c) => { res.statusCode = c; return res }
          res.json = (b) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(b)); return res }
          await handler(req, res)
        } catch (e) {
          res.statusCode = 500
          res.end(JSON.stringify({ error: String(e?.message || e) }))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [svelte(), apiDev()],
})
