# ADR-0002: No Real Authentication In P0

## Status

Accepted

## Context

The P0 backend is a competition demo backend, not a production platform. The demo must prioritize scenic data, route recommendation, RAG answers with sources, chat logs, admin maintenance, and degraded/mock operation.

Building registration, login, JWT sessions, password reset, RBAC, or multi-tenant permissions would increase scope without improving the first demo loop.

## Decision

Do not implement real authentication in P0.

Visitor APIs remain public. Admin and maintenance APIs may optionally be protected with a simple `ADMIN_TOKEN` header or environment variable switch, and demo mode may disable that protection to keep the flow stable.

## Consequences

- Frontend-backend integration stays simple.
- The demo cannot be presented as production-secure.
- Any real deployment beyond P0 must revisit authentication, authorization, auditability, and data protection.
