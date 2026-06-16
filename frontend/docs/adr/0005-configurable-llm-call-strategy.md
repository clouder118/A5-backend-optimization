# ADR-0005: Configurable LLM Call Strategy

## Status

Accepted

## Context

The P0 AI guide must support stable demos while also showing a real large-model integration. The intended first real provider is Xiaomi MIMO, with API details to be provided later.

The backend still needs to run when the model provider is unavailable, misconfigured, or temporarily disabled.

## Decision

Support a configurable LLM call strategy with at least three modes:

- `openai_compatible`: call a real OpenAI-compatible model provider. This is the default P0 mode, initially intended for Xiaomi MIMO once API details are available.
- `mock`: return deterministic demo answers based on retrieved knowledge chunks and preset templates.
- `disabled` or `fallback`: avoid external model calls and return a safe answer from retrieved snippets or a clear insufficient-information response.

The model mode must be controlled by configuration, not hard-coded in request handlers.

`/api/chat` should keep one stable response shape across all modes.

Initial configuration keys:

```env
APP_ENV=dev
DATABASE_URL=sqlite:///./data/app.db

LLM_MODE=openai_compatible
LLM_PROVIDER=mimo
LLM_BASE_URL=
LLM_API_KEY=
LLM_MODEL=

RAG_RETRIEVAL_MODE=keyword
ADMIN_TOKEN=
ENABLE_ADMIN_TOKEN=false
```

Missing real-model credentials must not prevent backend startup. If `/api/chat` is configured for `openai_compatible` but lacks usable provider settings, it should degrade to `mock` or `disabled/fallback` behavior and mark the response as degraded.

## Consequences

- P0 can demonstrate real model integration by default.
- The demo still has safe fallback paths when credentials, quota, network, or provider behavior fail.
- Provider-specific details must stay behind an LLM service boundary.
- Xiaomi MIMO API details remain an integration input to fill in later.
