<script>
  const COLUMNS = [
    { id: 'backlog', title: 'Backlog' },
    { id: 'todo', title: 'To Do' },
    { id: 'doing', title: 'Doing' },
    { id: 'done', title: 'Done' },
  ]

  let cards = $state({ backlog: [], todo: [], doing: [], done: [] })
  let drafts = $state({ backlog: '', todo: '', doing: '', done: '' })
  let loading = $state(true)
  let error = $state('')
  let editingId = $state(null)
  let editText = $state('')
  let copied = $state(false)
  let toast = $state('')
  let toastTimer
  let showImport = $state(false)
  let importText = $state('')

  const COL_ALIASES = {
    BACKLOG: 'backlog',
    'TO DO': 'todo',
    TODO: 'todo',
    DOING: 'doing',
    'IN PROGRESS': 'doing',
    DONE: 'done',
  }

  function parseChat(text) {
    const out = []
    let cur = null
    let pos = 0
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim()
      if (!line) continue
      // header? strip markdown + trailing "(n)"
      const head = line.replace(/[*_~]/g, '').replace(/\(\d+\)\s*$/, '').trim().toUpperCase()
      if (COL_ALIASES[head]) {
        cur = COL_ALIASES[head]
        continue
      }
      if (!cur) continue
      const t = line.replace(/^[•\-*]\s+/, '').replace(/[*_~]/g, '').trim()
      if (!t || t.toLowerCase() === '(empty)') continue
      out.push({ id: crypto.randomUUID(), col: cur, text: t, position: ++pos })
    }
    return out
  }

  async function applyImport() {
    const parsed = parseChat(importText)
    if (!parsed.length) {
      showToast('Nothing to import — check the format')
      return
    }
    cards = group(parsed)
    showImport = false
    importText = ''
    try {
      await send('/api/cards', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ cards: parsed }),
      })
      showToast(`Imported ${parsed.length} cards!`)
    } catch (e) {
      error = 'Import failed: ' + e.message
    }
  }

  function showToast(msg) {
    toast = msg
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => (toast = ''), 2000)
  }

  function boardToText() {
    const blocks = COLUMNS.map((col) => {
      const items = cards[col.id]
      const lines = items.length
        ? items.map((c) => `• ${c.text}`).join('\n')
        : '_(empty)_'
      return `*${col.title.toUpperCase()}* (${items.length})\n${lines}`
    })
    return blocks.join('\n\n')
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // fallback for non-secure contexts
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      ta.remove()
    }
  }

  async function copyBoard() {
    await copyText(boardToText())
    copied = true
    setTimeout(() => (copied = false), 1800)
  }

  function group(rows) {
    const next = { backlog: [], todo: [], doing: [], done: [] }
    for (const r of rows) {
      if (next[r.col]) next[r.col].push(r)
    }
    return next
  }

  // --- sync layer ---------------------------------------------------------
  // syncState: 'online' | 'syncing' | 'error'
  let syncState = $state('syncing')
  let lastSync = $state(0)
  let now = $state(Date.now())
  let pending = 0 // in-flight local writes; block polling from clobbering them
  let lastActivity = Date.now()
  const IDLE_MS = 10000 // pause polling after 10s of no interaction

  function bumpActivity() {
    const wasIdle = Date.now() - lastActivity > IDLE_MS
    lastActivity = Date.now()
    if (wasIdle) refetch() // resume immediately on return
  }

  const syncAgo = $derived.by(() => {
    if (!lastSync) return ''
    const s = Math.max(0, Math.round((now - lastSync) / 1000))
    if (s < 2) return 'just now'
    if (s < 60) return `${s}s ago`
    return `${Math.round(s / 60)}m ago`
  })

  function markSynced() {
    syncState = pending > 0 ? 'syncing' : 'online'
    lastSync = Date.now()
  }

  // wrapper for every mutating request: tracks sync status + errors
  async function send(url, opts) {
    pending++
    syncState = 'syncing'
    try {
      const r = await fetch(url, opts)
      if (!r.ok) throw new Error(await r.text())
      return r
    } catch (e) {
      syncState = 'error'
      throw e
    } finally {
      pending--
      if (pending === 0 && syncState !== 'error') markSynced()
    }
  }

  async function refetch({ silent = true } = {}) {
    if (!silent) loading = true
    if (silent && syncState !== 'error') syncState = 'syncing'
    try {
      const res = await fetch('/api/cards')
      if (!res.ok) throw new Error(await res.text())
      const rows = await res.json()
      // don't overwrite while the user is editing / importing / mid-write
      if (editingId === null && pending === 0 && !showImport) {
        cards = group(rows)
      }
      if (pending === 0) markSynced()
    } catch (e) {
      syncState = 'error'
      if (!silent) error = 'Failed to load: ' + e.message
    } finally {
      if (!silent) loading = false
    }
  }

  refetch({ silent: false })

  // periodic pull so every session converges (near-realtime)
  $effect(() => {
    const poll = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
      if (Date.now() - lastActivity > IDLE_MS) {
        if (syncState !== 'error') syncState = 'paused'
        return // idle: skip network until user interacts again
      }
      refetch()
    }, 4000)
    const clock = setInterval(() => (now = Date.now()), 1000)
    return () => {
      clearInterval(poll)
      clearInterval(clock)
    }
  })

  // track user interaction to drive idle pause / resume
  $effect(() => {
    const evs = ['pointerdown', 'keydown', 'touchstart', 'wheel', 'focus']
    for (const e of evs) window.addEventListener(e, bumpActivity, { passive: true })
    return () => evs.forEach((e) => window.removeEventListener(e, bumpActivity))
  })

  async function addCard(colId) {
    const text = drafts[colId].trim()
    if (!text) return
    const card = { id: crypto.randomUUID(), col: colId, text, position: Date.now() }
    cards[colId] = [...cards[colId], card]
    drafts[colId] = ''
    await send('/api/cards', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(card),
    }).catch(() => (error = 'Save failed'))
  }

  async function removeCard(colId, id) {
    cards[colId] = cards[colId].filter((c) => c.id !== id)
    await send('/api/cards?id=' + encodeURIComponent(id), { method: 'DELETE' })
      .catch(() => (error = 'Delete failed'))
  }

  function startEdit(card) {
    editingId = card.id
    editText = card.text
  }

  function cancelEdit() {
    editingId = null
    editText = ''
  }

  async function saveEdit(colId, id) {
    const text = editText.trim()
    if (!text) return cancelEdit()
    const card = cards[colId].find((c) => c.id === id)
    if (!card || text === card.text) return cancelEdit()
    cards[colId] = cards[colId].map((c) => (c.id === id ? { ...c, text } : c))
    editingId = null
    editText = ''
    await send('/api/cards', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, text }),
    }).catch(() => (error = 'Edit failed'))
  }

  async function move(colId, id, dir) {
    const idx = COLUMNS.findIndex((c) => c.id === colId)
    const target = COLUMNS[idx + dir]
    if (!target) return
    const card = cards[colId].find((c) => c.id === id)
    cards[colId] = cards[colId].filter((c) => c.id !== id)
    const position = Date.now()
    cards[target.id] = [...cards[target.id], { ...card, col: target.id, position }]
    // auto-copy updated board while still in the click gesture
    copyText(boardToText())
    showToast('Updates copied to clipboard!')
    await send('/api/cards', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, col: target.id, position }),
    }).catch(() => (error = 'Move failed'))
  }
</script>

<header>
  <h1>Mini Trello</h1>
  <span class="sync sync-{syncState}" title="Last sync {syncAgo}">
    <span class="dot"></span>
    {#if syncState === 'syncing'}Syncing…
    {:else if syncState === 'error'}Offline
    {:else if syncState === 'paused'}Paused{#if syncAgo} · {syncAgo}{/if}
    {:else}Synced{#if syncAgo} · {syncAgo}{/if}{/if}
  </span>
  <button class="copy" onclick={copyBoard}>{copied ? '✓ Copied' : 'Copy'}</button>
  <button class="paste" onclick={() => (showImport = true)}>Paste update</button>
  {#if error}<span class="err">{error}</span>{/if}
</header>

{#if showImport}
  <div class="sheet" onclick={() => (showImport = false)}>
    <div class="sheet-inner" onclick={(e) => e.stopPropagation()}>
      <h2>Paste board text</h2>
      <p class="hint">Paste a WhatsApp update. Recognizes <b>*BACKLOG*</b>, <b>*TO DO*</b>, <b>*DOING*</b>, <b>*DONE*</b> headers and <b>•</b> items. This replaces the whole board.</p>
      <textarea
        class="import-area"
        rows="10"
        placeholder={'*BACKLOG*\n• first task\n• second task\n\n*TO DO*\n• ...'}
        bind:value={importText}></textarea>
      <div class="sheet-actions">
        <button class="ghost-btn" onclick={() => (showImport = false)}>Cancel</button>
        <button class="primary" onclick={applyImport}>Apply</button>
      </div>
    </div>
  </div>
{/if}

{#if toast}
  <div class="toast">{toast}</div>
{/if}

<main>
  {#each COLUMNS as col, i}
    <section class="column">
      <div class="column-head">
        <span>{col.title}</span>
        <span class="count">{cards[col.id].length}</span>
      </div>

      <div class="cards">
        {#if loading}
          <p class="hint">Loading…</p>
        {/if}
        {#each cards[col.id] as card (card.id)}
          <article class="card">
            {#if editingId === card.id}
              <textarea
                class="edit"
                bind:value={editText}
                rows="2"
                onkeydown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(col.id, card.id) }
                  if (e.key === 'Escape') cancelEdit()
                }}
                {@attach (el) => el.focus()}
                onblur={() => saveEdit(col.id, card.id)}></textarea>
            {:else}
              <p onclick={() => startEdit(card)} title="Tap to edit">{card.text}</p>
            {/if}
            <div class="card-actions">
              <button
                class="ghost"
                disabled={i === 0}
                onclick={() => move(col.id, card.id, -1)}
                aria-label="Move left">◀</button>
              <button
                class="ghost del"
                onclick={() => removeCard(col.id, card.id)}
                aria-label="Delete">✕</button>
              <button
                class="ghost"
                disabled={i === COLUMNS.length - 1}
                onclick={() => move(col.id, card.id, 1)}
                aria-label="Move right">▶</button>
            </div>
          </article>
        {/each}
      </div>

      <form class="add" onsubmit={(e) => { e.preventDefault(); addCard(col.id) }}>
        <input
          placeholder="Add a card…"
          bind:value={drafts[col.id]} />
        <button type="submit" aria-label="Add card">+</button>
      </form>
    </section>
  {/each}
</main>

<style>
  header {
    padding: env(safe-area-inset-top) 16px 0;
    padding-top: max(env(safe-area-inset-top), 12px);
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px 10px;
  }
  h1 {
    margin: 8px 8px 8px 0;
    font-size: 20px;
    letter-spacing: 0.5px;
    margin-right: auto;
  }
  .copy {
    background: #25d366;
    color: #04220f;
    border: none;
    border-radius: 8px;
    padding: 7px 12px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }
  .copy:active { transform: scale(0.96); }
  .paste {
    background: var(--surface-2);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 7px 12px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }
  .paste:active { transform: scale(0.96); }
  .err { color: #f87171; font-size: 13px; }
  .sync {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--muted);
    padding: 4px 10px;
    border: 1px solid var(--border);
    border-radius: 999px;
    white-space: nowrap;
  }
  .sync .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--muted);
  }
  .sync-online .dot { background: #22c55e; }
  .sync-syncing .dot { background: #38bdf8; animation: pulse 1s infinite; }
  .sync-paused .dot { background: #eab308; }
  .sync-error { color: #f87171; }
  .sync-error .dot { background: #f87171; }
  @keyframes pulse { 50% { opacity: 0.3; } }

  .sheet {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    z-index: 100;
  }
  .sheet-inner {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 16px 16px 0 0;
    width: 100%;
    max-width: 560px;
    padding: 18px 16px calc(18px + env(safe-area-inset-bottom));
    animation: slideup 0.2s ease;
  }
  @keyframes slideup {
    from { transform: translateY(30px); opacity: 0.6; }
    to { transform: translateY(0); opacity: 1; }
  }
  .sheet-inner h2 { margin: 0 0 6px; font-size: 17px; }
  .sheet-inner .hint { margin: 0 0 12px; font-size: 13px; color: var(--muted); }
  .import-area {
    width: 100%;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 10px 12px;
    font-size: 14px;
    line-height: 1.4;
    resize: vertical;
    outline: none;
    color: var(--text);
  }
  .import-area:focus { border-color: var(--accent); }
  .sheet-actions {
    display: flex;
    gap: 10px;
    justify-content: flex-end;
    margin-top: 14px;
  }
  .ghost-btn {
    background: transparent;
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 10px 16px;
    cursor: pointer;
  }
  .primary {
    background: var(--accent);
    color: #04222f;
    border: none;
    border-radius: 8px;
    padding: 10px 18px;
    font-weight: 700;
    cursor: pointer;
  }
  .toast {
    position: fixed;
    left: 50%;
    bottom: calc(20px + env(safe-area-inset-bottom));
    transform: translateX(-50%);
    background: #25d366;
    color: #04220f;
    font-weight: 600;
    font-size: 14px;
    padding: 10px 18px;
    border-radius: 999px;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
    z-index: 50;
    animation: pop 0.18s ease;
  }
  @keyframes pop {
    from { opacity: 0; transform: translate(-50%, 8px); }
    to { opacity: 1; transform: translate(-50%, 0); }
  }
  .hint { color: var(--muted); font-size: 13px; padding: 4px 6px; }
  main {
    display: flex;
    gap: 12px;
    padding: 0 12px 16px;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    flex: 1;
    min-height: 0;
    -webkit-overflow-scrolling: touch;
  }
  .column {
    flex: 0 0 82vw;
    max-width: 320px;
    scroll-snap-align: start;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 14px;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .column-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 14px;
    font-weight: 600;
    font-size: 14px;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    color: var(--muted);
  }
  .count {
    background: var(--surface-2);
    color: var(--text);
    border-radius: 999px;
    padding: 1px 9px;
    font-size: 12px;
  }
  .cards {
    flex: 1;
    overflow-y: auto;
    padding: 0 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .card {
    background: var(--surface-2);
    border-radius: 10px;
    padding: 10px 12px;
  }
  .card p {
    margin: 0 0 8px;
    font-size: 15px;
    line-height: 1.35;
    word-break: break-word;
    cursor: text;
  }
  .edit {
    width: 100%;
    margin-bottom: 8px;
    background: var(--bg);
    border: 1px solid var(--accent);
    border-radius: 8px;
    padding: 8px 10px;
    font-size: 15px;
    line-height: 1.35;
    resize: vertical;
    outline: none;
  }
  .card-actions {
    display: flex;
    justify-content: space-between;
    gap: 6px;
  }
  .ghost {
    background: transparent;
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 6px 10px;
    min-width: 40px;
    cursor: pointer;
  }
  .ghost:disabled { opacity: 0.25; }
  .ghost.del { color: #f87171; }
  .add {
    display: flex;
    gap: 8px;
    padding: 10px;
  }
  .add input {
    flex: 1;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 10px 12px;
    outline: none;
  }
  .add input:focus { border-color: var(--accent); }
  .add button {
    background: var(--accent);
    color: #04222f;
    border: none;
    border-radius: 8px;
    width: 44px;
    font-size: 22px;
    font-weight: 700;
    cursor: pointer;
  }

  @media (min-width: 720px) {
    .column { flex-basis: 300px; }
  }
</style>
