create extension if not exists vector;

create table skills (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  material text not null check (material in ('plastik_pet','plastik_hdpe','kardus','kaleng','kaca','sachet')),
  difficulty text not null check (difficulty in ('pemula','menengah','mahir')),
  tools jsonb not null default '[]',
  steps jsonb not null default '[]',
  risks jsonb not null default '[]',
  est_cost_idr int,
  est_price_idr int,
  sources jsonb not null default '[]',
  status text not null default 'draft' check (status in ('draft','approved','rejected','needs_revision')),
  origin text not null check (origin in ('seed','discovered')),
  reviewed_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table skill_chunks (
  id uuid primary key default gen_random_uuid(),
  skill_id uuid not null references skills(id) on delete cascade,
  content text not null,
  embedding vector(1024) not null,
  fts tsvector generated always as (to_tsvector('indonesian', content)) stored,
  metadata jsonb not null default '{}'
);

create table scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  image_url text,
  material text,
  condition text,
  confidence real,
  raw_json jsonb,
  created_at timestamptz not null default now()
);

create table agent_runs (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid references scans(id),
  query text not null,
  retrieved_chunk_ids uuid[] not null default '{}',
  gate_path jsonb not null default '[]',
  answer text,
  latency_ms int,
  created_at timestamptz not null default now()
);

create index skill_chunks_embedding_idx on skill_chunks using hnsw (embedding vector_cosine_ops);
create index skill_chunks_fts_idx on skill_chunks using gin (fts);
create index skills_status_idx on skills (status);
create index scans_user_id_idx on scans (user_id);

create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger skills_updated_at
  before update on skills
  for each row execute function set_updated_at();

-- Hybrid retrieval: pgvector cosine + Postgres FTS (indonesian), fused with
-- Reciprocal Rank Fusion. "Lexical search" in docs - not BM25 (spec §2).
create or replace function hybrid_search(
  query_embedding vector(1024),
  query_text text,
  material_filter text default null,
  match_count int default 20,
  rrf_k int default 60
) returns table (chunk_id uuid, skill_id uuid, content text, metadata jsonb, score double precision)
language sql stable as $$
  with vec as (
    select id, row_number() over (order by embedding <=> query_embedding) as rank
    from skill_chunks
    where material_filter is null or metadata->>'material' = material_filter
    order by embedding <=> query_embedding
    limit greatest(match_count * 2, 40)
  ),
  lex as (
    select id, row_number() over (
      order by ts_rank_cd(fts, websearch_to_tsquery('indonesian', query_text)) desc
    ) as rank
    from skill_chunks
    where fts @@ websearch_to_tsquery('indonesian', query_text)
      and (material_filter is null or metadata->>'material' = material_filter)
    limit greatest(match_count * 2, 40)
  )
  select c.id, c.skill_id, c.content, c.metadata,
         coalesce(1.0 / (rrf_k + vec.rank), 0) + coalesce(1.0 / (rrf_k + lex.rank), 0) as score
  from skill_chunks c
  left join vec on vec.id = c.id
  left join lex on lex.id = c.id
  where vec.id is not null or lex.id is not null
  order by score desc
  limit match_count;
$$;

alter table skills enable row level security;
alter table skill_chunks enable row level security;
alter table scans enable row level security;
alter table agent_runs enable row level security;

create policy "skills readable by all" on skills for select using (true);
create policy "chunks readable by all" on skill_chunks for select using (true);
create policy "users read own scans" on scans for select using (auth.uid() = user_id);
-- Writes and status changes go through the service role only (bypasses RLS);
-- no insert/update policies are defined on purpose. agent_runs is service-only.
