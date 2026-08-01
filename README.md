# Mini Trello

Lightweight mobile-first kanban board. No auth, no backend — state persists in `localStorage`.

Four columns: **Backlog → To Do → Doing → Done**. Add, delete, and move cards with ◀ ▶.

## Stack
- Svelte 5 + Vite — tiny bundle (~15 kB gzip), instant dev, ~1.6s build.

## Local
```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # outputs to dist/
```

## Deploy (Vercel)
1. Push this repo to GitHub.
2. Import into Vercel — it auto-detects Vite.
   - Build command: `npm run build`
   - Output dir: `dist`
3. Deploy. Live.
