-- Documents: curated PDF/URL sources ingested into the RAG corpus (spec 2026-08-05).
create table documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  source_type text not null check (source_type in ('pdf', 'url')),
  url text,
  file_path text,
  materials text[] not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_by uuid,
  reviewed_by text,
  indexed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  content text not null,
  embedding vector(1024) not null,
  fts tsvector generated always as (to_tsvector('indonesian', content)) stored,
  metadata jsonb not null default '{}'
);

create index document_chunks_embedding_idx on document_chunks using hnsw (embedding vector_cosine_ops);
create index document_chunks_fts_idx on document_chunks using gin (fts);
create index documents_status_idx on documents (status);
create index document_chunks_document_id_idx on document_chunks (document_id);

create trigger documents_updated_at
  before update on documents
  for each row execute function set_updated_at();

alter table documents enable row level security;
alter table document_chunks enable row level security;

create policy "documents approved readable" on documents for select using (status = 'approved');
create policy "document_chunks readable by all" on document_chunks for select using (true);

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- Unified hybrid retrieval over skill + document chunks (spec §4.1).
create or replace function hybrid_search(
  query_embedding vector(1024),
  query_text text,
  material_filter text default null,
  match_count int default 20,
  rrf_k int default 60
) returns table (chunk_id uuid, source_type text, source_id uuid, content text, metadata jsonb, score double precision)
language sql stable as $$
  with vec_skill as (
    select id, row_number() over (order by embedding <=> query_embedding) as rank
    from skill_chunks
    where material_filter is null or metadata->>'material' = material_filter
    order by embedding <=> query_embedding
    limit greatest(match_count * 2, 40)
  ),
  lex_skill as (
    select id, row_number() over (
      order by ts_rank_cd(fts, websearch_to_tsquery('indonesian', query_text)) desc
    ) as rank
    from skill_chunks
    where fts @@ websearch_to_tsquery('indonesian', query_text)
      and (material_filter is null or metadata->>'material' = material_filter)
    limit greatest(match_count * 2, 40)
  ),
  vec_doc as (
    select id, row_number() over (order by embedding <=> query_embedding) as rank
    from document_chunks
    where material_filter is null or metadata->'materials' ? material_filter
    order by embedding <=> query_embedding
    limit greatest(match_count * 2, 40)
  ),
  lex_doc as (
    select id, row_number() over (
      order by ts_rank_cd(fts, websearch_to_tsquery('indonesian', query_text)) desc
    ) as rank
    from document_chunks
    where fts @@ websearch_to_tsquery('indonesian', query_text)
      and (material_filter is null or metadata->'materials' ? material_filter)
    limit greatest(match_count * 2, 40)
  )
  select c.id,
         'skill' as source_type, c.skill_id as source_id, c.content, c.metadata,
         coalesce(1.0 / (rrf_k + vec_skill.rank), 0) + coalesce(1.0 / (rrf_k + lex_skill.rank), 0) as score
  from skill_chunks c
  left join vec_skill on vec_skill.id = c.id
  left join lex_skill on lex_skill.id = c.id
  where vec_skill.id is not null or lex_skill.id is not null
  union all
  select c.id,
         'document' as source_type, c.document_id as source_id, c.content, c.metadata,
         coalesce(1.0 / (rrf_k + vec_doc.rank), 0) + coalesce(1.0 / (rrf_k + lex_doc.rank), 0) as score
  from document_chunks c
  left join vec_doc on vec_doc.id = c.id
  left join lex_doc on lex_doc.id = c.id
  where vec_doc.id is not null or lex_doc.id is not null
  order by score desc
  limit match_count;
$$;
