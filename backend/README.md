# A5 AI Guide Backend

FastAPI backend skeleton for the A5 scenic-area AI digital human P0 demo.

## Local Startup

Create and activate a Python virtual environment, then install dependencies:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

Run the API:

```powershell
python -m uvicorn app.main:app --reload
```

Open Swagger at:

```text
http://127.0.0.1:8000/docs
```

Health check:

```text
GET http://127.0.0.1:8000/health
```

Expected response:

```json
{
  "status": "ok",
  "service": "a5-ai-guide-backend"
}
```

## Data Bootstrap

On startup, the backend creates the SQLite schema and, when the database has no
scenic spots, bootstraps Ling Shan demo data from the configured source package.

Default source package:

```text
..\Scenic Area Public Information Package
```

Override it with:

```powershell
$env:SOURCE_PACKAGE_PATH="D:\ws01\v1\Scenic Area Public Information Package"
```

The source Word/Excel files are treated as read-only. Bootstrap writes only to
the application database.

Derived knowledge lives outside the raw package:

```text
..\knowledge
```

Override it with:

```powershell
$env:DERIVED_KNOWLEDGE_PATH="D:\ws01\v1\knowledge"
```

The derived package separates reviewed structured JSON files, Markdown narrative
docs, and tabular-data notes. Bootstrap imports Markdown docs as knowledge chunks
for AI guide answers. Structured JSON files are the curated input for later
database-first Q&A work and do not modify the raw Word/Excel files.

Structured curated data currently seeds these database areas:

- `spot_fact`: official structured scenic facts from the curated package.
- `entity_alias` and `tag_alias`: deterministic matching support for later
  structured-first question classification.
- `source_ref`: local source provenance for curated facts.
- `approved_web_source` and `approved_web_fact`: reviewed web supplemental
  sources and facts kept separate from official scenic facts.
- `web_fact_candidate`: pending review candidates for future real-time web
  supplements. Bootstrap does not trust or populate candidates automatically.

## Chat Fallback

`POST /api/chat` works without a real model key. If `LLM_MODE` is
`openai_compatible` but `LLM_API_KEY` is empty, the endpoint uses local keyword
retrieval and returns a fallback answer with `degraded=true`.

MiMo defaults:

```powershell
$env:LLM_MODE="openai_compatible"
$env:LLM_PROVIDER="mimo"
$env:LLM_BASE_URL="https://api.xiaomimimo.com/v1"
$env:LLM_MODEL="mimo-v2.5"
$env:TTS_MODE="provider"
$env:TTS_PROVIDER="mimo"
$env:TTS_BASE_URL="https://api.xiaomimimo.com/v1"
$env:TTS_MODEL="mimo-v2.5-tts"
$env:TTS_VOICE="mimo_default"
$env:TTS_AUDIO_FORMAT="mp3"
$env:MIMO_API_KEY="<your-api-key>"
```

`MIMO_API_KEY` is used as the default for both LLM and TTS. Do not commit real
API keys. Use `.env.example` as a template and keep local `.env` files private.

The real MiMo network call is intentionally not required for the P0 fallback
path.

## Admin APIs

P0 admin endpoints write to the SQLite database and never modify the original
Word/Excel source package.

Available admin/status endpoints:

```text
POST   /api/admin/spots
PUT    /api/admin/spots/{spot_id}
DELETE /api/admin/spots/{spot_id}
POST   /api/admin/routes
PUT    /api/admin/routes/{route_id}
DELETE /api/admin/routes/{route_id}
GET    /api/knowledge/docs
POST   /api/knowledge/rebuild
GET    /api/logs/chats
```

Admin token protection is optional and disabled by default:

```powershell
$env:ENABLE_ADMIN_TOKEN="true"
$env:ADMIN_TOKEN="<admin-token>"
```

When enabled, send the token as:

```text
x-admin-token: <admin-token>
```

## Tests

```powershell
python -m pytest
```
