# Backend P0 Development Guide

This guide captures the confirmed backend scope for the A5 scenic-area AI digital human P0 demo.

## Goal

Build the minimum backend needed for the demo loop:

`scenic data -> route recommendation -> RAG answer with sources -> backend TTS audio URL -> chat logs -> admin maintenance -> mock/degraded operation`

Do not build production platform features in P0. Registration, real login, RBAC, multi-tenant scenic areas, real GPS, ticketing, orders, and personalized long-term memory are out of scope.

## Project Location

Create the backend at:

```text
D:\ws01\v1\backend
```

Recommended structure:

```text
backend/
  app/
    api/
    core/
    db/
    models/
    schemas/
    services/
    main.py
  data/
    app.db
    tts/
  tests/
  README.md
  requirements.txt
```

## Stack

- FastAPI for HTTP APIs and Swagger/OpenAPI.
- SQLAlchemy for ORM and database portability.
- SQLite as the default development/demo database.
- Keep the model layer compatible with a later PostgreSQL migration.
- pytest + FastAPI TestClient for tests.

## Configuration

Use `.env` and environment variables as the only configuration entry point.

```env
APP_ENV=dev
DATABASE_URL=sqlite:///./data/app.db

LLM_MODE=openai_compatible
LLM_PROVIDER=mimo
LLM_BASE_URL=
LLM_API_KEY=
LLM_MODEL=

RAG_RETRIEVAL_MODE=keyword

TTS_MODE=provider
TTS_PROVIDER=
TTS_BASE_URL=
TTS_API_KEY=
TTS_VOICE=

ADMIN_TOKEN=
ENABLE_ADMIN_TOKEN=false
```

Missing real LLM or TTS credentials must not prevent backend startup. Runtime calls should degrade clearly and return status fields.

## Data Source

The first scenic-area scope is Ling Shan.

Source material lives in:

```text
D:\ws01\v1\Scenic Area Public Information Package
```

Current package contents:

- `灵山胜境 景点结构化数据集.docx`
- `灵山胜境：历史、文化、景点特色与个性化游览指南.docx`
- `景点景区旅游数据行为分析数据.xlsx`

Treat this package as read-only. On startup, if the database is empty, import initial scenic spots, routes, and knowledge docs from the package or derived seed files.

Admin CRUD writes to the database, not to the original Word/Excel files.

## API Style

Successful responses return resources directly. Do not wrap success responses in a generic envelope.

Use a unified error shape:

```json
{
  "message": "景点不存在",
  "code": "SPOT_NOT_FOUND",
  "status": 404
}
```

List responses can use:

```json
{
  "items": [],
  "total": 0
}
```

## P0 Endpoints

Minimum first-stage endpoints:

- `GET /health`
- `GET /api/spots`
- `GET /api/spots/{id}`
- `POST /api/routes/recommend`
- `POST /api/chat`
- `POST /api/knowledge/rebuild`

P0 admin endpoints:

- `POST /api/admin/spots`
- `PUT /api/admin/spots/{id}`
- `DELETE /api/admin/spots/{id}`
- `GET /api/routes`
- route CRUD endpoints
- `GET /api/knowledge/docs`
- `GET /api/logs/chats`

Visitor APIs are public. Admin APIs may use optional `ADMIN_TOKEN` protection, disabled by default for demo stability.

## RAG

Use two-level retrieval:

1. Required P0 path: local keyword-style retrieval over parsed knowledge chunks.
2. Reserved future path: embedding/vector-store implementation behind the same retrieval service interface.

Public chat behavior must not depend on the concrete retrieval implementation.

Source objects should be chunk-level:

```json
{
  "title": "灵山胜境：历史、文化、景点特色与个性化游览指南",
  "spot_name": "灵山大佛",
  "section": "历史文化",
  "snippet": "80-160 字片段",
  "score": 0.82
}
```

## LLM

Support configurable strategy:

- `openai_compatible`: default real-model mode, intended for Xiaomi MIMO once API details are provided.
- `mock`: deterministic demo answers from retrieved chunks/templates.
- `disabled` or `fallback`: no external call; answer safely from snippets or admit insufficient information.

If `openai_compatible` is selected but credentials are missing, `/api/chat` should degrade rather than fail startup.

## Chat Session

Use lightweight sessions only:

- `/api/chat` accepts optional `session_id`.
- If absent, backend creates one and returns it.
- Store `chat_session` and `chat_message` for logs.
- Include at most the recent 3-5 turns for follow-up context.
- No account-level memory, cross-day preferences, or long-term personalization in P0.

## TTS

Backend owns P0 TTS.

Use synchronous generation:

1. Generate text answer.
2. Call configured TTS provider.
3. Save successful audio to `backend/data/tts/<hash>.mp3`.
4. Return `audio_url` and `tts_status="ready"`.
5. If TTS fails, return text answer with `audio_url=null` and `tts_status="failed"` or `tts_status="disabled"`.

TTS failure must never block the text answer. Frontend browser speech can remain a fallback.

## Route Recommendation

Generate route plans from rules and database-backed spot/route data.

Inputs:

- `visitor_type`
- `duration_minutes`
- `physical_level`
- `interest_tags`

Outputs:

- 1-3 route candidates
- ordered spots
- stay minutes
- recommendation reasons

LLM may polish recommendation text only. It must not invent route plans.

## First-Stage Done Criteria

The backend first stage is complete when:

- `D:\ws01\v1\backend` exists with the project structure above.
- FastAPI starts and `GET /health` succeeds.
- SQLite initializes successfully.
- Seed/bootstrap creates Ling Shan spots and routes.
- `GET /api/spots` and `GET /api/spots/{id}` work.
- `POST /api/routes/recommend` returns rule-based explainable routes.
- `POST /api/chat` returns `answer`, `sources`, `session_id`, `audio_url`, and `tts_status` using keyword retrieval plus mock/fallback behavior.
- `/docs` shows Swagger.
- pytest covers the first-stage main path.
- README explains local startup, Docker Compose startup, and MIMO/TTS configuration placeholders.

Real Xiaomi MIMO and real TTS provider integration can happen after API details are provided.
