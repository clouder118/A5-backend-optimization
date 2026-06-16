# ADR-0003: Knowledge Bootstrap From Public Package

## Status

Accepted

## Context

The first P0 scenic-area scope is Ling Shan. Source materials live in `D:\ws01\v1\Scenic Area Public Information Package` and include Word documents for structured spot/history/culture content plus a tourism behavior analysis spreadsheet.

The backend must be easy to start for demos and should avoid manual multi-step data preparation.

## Decision

Treat the scenic-area public information package as the read-only source for P0 knowledge bootstrap.

On backend startup, if the database is empty, import initial scenic spots, routes, and knowledge documents from the package or derived seed files. Provide `POST /api/knowledge/rebuild` for manual knowledge index rebuilding.

P0 does not require parsing newly uploaded Word or Excel files in real time through the admin UI.

## Consequences

- Demo startup is simpler and repeatable.
- Admin knowledge management can focus on document visibility and rebuild status.
- Original source files remain unchanged.
- A future version can add upload-and-parse workflows without blocking P0.
