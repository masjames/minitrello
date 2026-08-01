-- Run once in the Neon SQL editor.
create table if not exists cards (
  id text primary key,
  col text not null,
  text text not null,
  position double precision not null default 0,
  created_at timestamptz default now()
);

create index if not exists cards_col_position_idx on cards (col, position);

-- Seed the board with the current backlog / todo / doing items.
insert into cards (id, col, text, position) values
  (gen_random_uuid()::text, 'backlog', '[High] Fix project cannot assign Career Compass + MHCU — claim error', 1),
  (gen_random_uuid()::text, 'backlog', '[Medium] Explore file storage — 100GB ~ $2/mo', 2),
  (gen_random_uuid()::text, 'backlog', '[High] Galih buy Rp200k prepaid for tgl 2', 3),

  (gen_random_uuid()::text, 'todo', 'MHCU test from magic link (Adit)', 1),
  (gen_random_uuid()::text, 'todo', 'Re-send project to remaining psychologist (RANA)', 2),
  (gen_random_uuid()::text, 'todo', 'Batch download (Adit)', 3),
  (gen_random_uuid()::text, 'todo', 'Guideline: admin how-to + psychologist how-to (Galih)', 4),

  (gen_random_uuid()::text, 'doing', 'Fixing DISC+BFI — Report & Party viewer access for Psychologist (Galih)', 1),
  (gen_random_uuid()::text, 'doing', 'Pandu Rana buat flow project invite', 2),

  (gen_random_uuid()::text, 'done', 'Create BI DISC + BFI capability', 1),
  (gen_random_uuid()::text, 'done', 'Manual regenerate', 2),
  (gen_random_uuid()::text, 'done', 'Automated regenerate', 3),
  (gen_random_uuid()::text, 'done', 'Report PDF download (David) — cont. check w/ Adit', 4),
  (gen_random_uuid()::text, 'done', 'Check BI DISC BFI Report viewer', 5),
  (gen_random_uuid()::text, 'done', 'Regression: running the BI test', 6);
