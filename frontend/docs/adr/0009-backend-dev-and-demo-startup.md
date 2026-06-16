# ADR-0009: Backend Dev And Demo Startup

## Status

Accepted

## Context

The backend must be easy to develop locally and also easy to run during a P0 demo. The current P0 database default is SQLite, so no separate database container is required yet.

## Decision

Support two startup paths:

- Local development: Python virtual environment, `pip install -r requirements.txt`, and `uvicorn app.main:app --reload`.
- Demo startup: Docker Compose entry point that can start the backend, and later the frontend if needed.

SQLite mode should not require a database container. If the project later moves to PostgreSQL, Docker Compose can add a PostgreSQL service.

README documentation must cover both startup paths.

## Consequences

- Backend development remains fast and simple.
- Demo setup has a repeatable command.
- Docker does not become a blocker for routine local work.
