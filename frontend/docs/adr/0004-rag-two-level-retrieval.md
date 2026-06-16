# ADR-0004: RAG Two-Level Retrieval

## Status

Accepted

## Context

The P0 demo needs AI guide answers grounded in Ling Shan source materials, with visible sources and stable fallback behavior. A full embedding model plus vector store can improve semantic matching, but adds API keys, dependencies, indexing complexity, and demo risk.

## Decision

Use a two-level retrieval strategy for P0.

The default required path is local keyword-style retrieval over parsed knowledge chunks. The service interface should reserve a replaceable retrieval boundary for future embedding/vector-store implementations.

`/api/chat` must depend on a stable retrieval contract, not on the concrete retrieval implementation.

## Consequences

- P0 can run without external embedding APIs or vector database services.
- Retrieval quality is sufficient for controlled demo questions if source chunks are structured well.
- Future embedding/vector-store support can be added behind the same service boundary.
- The team should avoid exposing keyword-specific details in public API response contracts.
