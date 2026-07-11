# 002 — Vector search with pgvector over a dedicated vector database

**Status:** Accepted

## Context

Retrieval needs approximate nearest-neighbor search over embedded chunks. A
dedicated vector database (Pinecone, Weaviate, Milvus) is one option; the other
is pgvector inside the Postgres the app already runs.

## Decision

Use pgvector, with an HNSW index over cosine distance and a SECURITY DEFINER
`match_chunks` function as the retrieval entry point. Chunks carry subject and
tag columns so retrieval is filtered relationally before ranking by similarity.

## Consequences

- One datastore to operate, back up, and reason about; corpus rows and their
  metadata live next to the vectors, so filtering is a plain SQL predicate, not
  a metadata-sync problem across two systems.
- Transactions span content and embeddings — no dual-write consistency window.
- At very large scale a specialized vector store may outperform pgvector; the
  retrieval seam (`KnowledgeSource`) means swapping it is a local change, and
  ADR-009's graceful-empty contract makes the migration low-risk.
