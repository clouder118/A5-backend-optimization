# ADR-0006: Backend TTS In P0

## Status

Accepted

## Context

The P0 digital human experience should include spoken AI guide answers. The frontend can fall back to browser speech, but the intended primary voice path is backend-generated TTS audio. The TTS model API details will be provided later.

## Decision

Implement backend TTS support for P0.

`/api/chat` should be able to return an `audio_url` for the generated answer when TTS succeeds. Provider-specific TTS API details must stay behind a TTS service boundary.

Frontend browser speech may remain a fallback when backend TTS is unavailable.

Use synchronous TTS generation in P0:

1. Generate the text answer.
2. Call the configured TTS provider.
3. Save successful audio under a local cache such as `backend/data/tts/<hash>.mp3`.
4. Return `audio_url` and `tts_status="ready"`.
5. If TTS fails, return the text answer with `audio_url=null` and `tts_status="failed"` or `tts_status="disabled"`.

P0 should not require async queues, polling, or WebSocket delivery for TTS.

## Consequences

- The backend owns model-to-audio integration, generated audio storage, and stable audio URLs.
- The `/api/chat` response must keep `audio_url` optional because TTS can fail independently from text answering.
- The P0 implementation needs a clear fallback path so failed TTS does not block the chat answer.
