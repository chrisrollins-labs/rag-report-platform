-- 0006 — RAG corpus with vector search (ADR-002, ADR-009).
--
-- Documents are chunked and embedded; retrieval matches a query embedding
-- against the chunk vectors over an HNSW index, filtered by subject and tags.
-- The match function is SECURITY DEFINER so retrieval runs with a controlled,
-- read-only surface rather than broad table grants.

create table rag.documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subject text not null,
  source text not null,
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table rag.chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references rag.documents (id) on delete cascade,
  content text not null,
  subject text not null,
  tags text[] not null default '{}',
  -- text-embedding-3-small dimensionality; change with your embedding model.
  embedding vector(1536),
  created_at timestamptz not null default now()
);

-- HNSW over cosine distance: fast approximate nearest-neighbor at corpus scale.
create index rag_chunks_embedding_hnsw
  on rag.chunks using hnsw (embedding vector_cosine_ops);
create index rag_chunks_subject on rag.chunks (subject);

-- Retrieval entry point. Cosine similarity, subject-scoped, optional tag
-- overlap filter, ordered by similarity. Returns only what generation needs.
create or replace function rag.match_chunks(
  query_embedding vector(1536),
  match_count integer,
  filter_subject text,
  filter_tags text[] default null
)
returns table (
  chunk_id uuid,
  document_id uuid,
  title text,
  source text,
  content text,
  similarity real
)
language sql stable security definer
set search_path = rag, public
as $$
  select
    c.id,
    c.document_id,
    d.title,
    d.source,
    c.content,
    1 - (c.embedding <=> query_embedding) as similarity
  from rag.chunks c
  join rag.documents d on d.id = c.document_id
  where c.embedding is not null
    and c.subject = filter_subject
    and (filter_tags is null or c.tags && filter_tags)
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

alter table rag.documents enable row level security;
create policy rag_documents_service_only on rag.documents
  using (false) with check (false);

alter table rag.chunks enable row level security;
create policy rag_chunks_service_only on rag.chunks
  using (false) with check (false);
