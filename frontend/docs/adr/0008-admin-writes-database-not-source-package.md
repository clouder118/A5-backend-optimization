# ADR-0008: Admin Writes Database Not Source Package

## Status

Accepted

## Context

P0 uses `D:\ws01\v1\Scenic Area Public Information Package` as the read-only source for initial Ling Shan scenic-area knowledge. Admin pages still need to demonstrate engineering completeness through spot, route, knowledge, and chat-log management.

Writing back to Word or Excel source files would add parsing and consistency risk.

## Decision

Admin CRUD writes to the application database, not to the original public information package.

Spot management writes `scenic_spot`. Route management writes `route` and `route_spot`. Knowledge management can show imported documents, chunk/index status, and trigger rebuilds. Chat logs are read-only in P0.

P0 does not require editing original Word/Excel source files from the admin UI.

## Consequences

- Original source materials remain stable and auditable.
- Admin changes can affect visitor-facing database-backed content.
- Knowledge rebuild behavior stays explicit.
- A future version can add document upload/edit workflows separately.
