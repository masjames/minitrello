<script>
  const COLUMNS = [
    { id: 'backlog', title: 'Backlog' },
    { id: 'todo', title: 'To Do' },
    { id: 'doing', title: 'Doing' },
    { id: 'done', title: 'Done' },
  ]

  const STORAGE_KEY = 'minitrello.v1'

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) return JSON.parse(raw)
    } catch {}
    return {
      backlog: [{ id: crypto.randomUUID(), text: 'Tap + to add a card' }],
      todo: [],
      doing: [],
      done: [],
    }
  }

  let cards = $state(load())
  let drafts = $state({ backlog: '', todo: '', doing: '', done: '' })

  $effect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cards))
  })

  function addCard(colId) {
    const text = drafts[colId].trim()
    if (!text) return
    cards[colId] = [...cards[colId], { id: crypto.randomUUID(), text }]
    drafts[colId] = ''
  }

  function removeCard(colId, id) {
    cards[colId] = cards[colId].filter((c) => c.id !== id)
  }

  function move(colId, id, dir) {
    const idx = COLUMNS.findIndex((c) => c.id === colId)
    const target = COLUMNS[idx + dir]
    if (!target) return
    const card = cards[colId].find((c) => c.id === id)
    cards[colId] = cards[colId].filter((c) => c.id !== id)
    cards[target.id] = [...cards[target.id], card]
  }
</script>

<header>
  <h1>Mini Trello</h1>
</header>

<main>
  {#each COLUMNS as col, i}
    <section class="column">
      <div class="column-head">
        <span>{col.title}</span>
        <span class="count">{cards[col.id].length}</span>
      </div>

      <div class="cards">
        {#each cards[col.id] as card (card.id)}
          <article class="card">
            <p>{card.text}</p>
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
  }
  h1 {
    margin: 8px 0 12px;
    font-size: 20px;
    letter-spacing: 0.5px;
  }
  main {
    display: flex;
    gap: 12px;
    padding: 0 12px 16px;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    height: calc(100dvh - 56px);
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
