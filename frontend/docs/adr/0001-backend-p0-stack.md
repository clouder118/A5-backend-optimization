# ADR-0001: Backend P0 Stack

## Status

Accepted

## Context

The backend must support the P0 demo loop quickly and reliably: scenic data, route recommendation, RAG-based guide answers, sources, chat logs, admin maintenance, and degraded/mock operation. The team wants a basic necessary framework first, with personalized features deferred.

## Decision

Use FastAPI + SQLAlchemy for the P0 backend.

Use SQLite as the default development and demo database to reduce setup friction, while keeping SQLAlchemy models and data access compatible with a later PostgreSQL migration.

## Consequences

- FastAPI provides OpenAPI/Swagger for frontend-backend contract alignment.
- SQLite keeps local startup and demo setup simple.
- SQLAlchemy keeps the persistence layer portable enough for PostgreSQL later.
- P0 should avoid database-specific features that would make PostgreSQL migration expensive.
