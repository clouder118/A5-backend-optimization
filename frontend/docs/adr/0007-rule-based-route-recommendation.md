# ADR-0007: Rule-Based Route Recommendation

## Status

Accepted

## Context

P0 route recommendation must be explainable, stable, and safe for demo. Letting a large model freely generate route plans risks nonexistent spots, unrealistic timing, and inconsistent results.

## Decision

Generate P0 route recommendations from rules and database-backed route/spot data.

The route service may call the configured LLM only to polish recommendation text, not to invent the route plan itself.

Inputs include visitor type, duration, physical level, and interest tags. Outputs include 1-3 route candidates with ordered spots, stay minutes, and recommendation reasons.

## Consequences

- Route plans stay deterministic and testable.
- The frontend can rely on stable route fields.
- LLM failure does not block route recommendation because template reasons can be returned.
- Future personalization can improve scoring without changing the public route API shape.
