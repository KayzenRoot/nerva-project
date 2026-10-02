# ADR-0001 — Deterministic Financial Authorization Boundary

Status: APPROVED — NERVA-WO-001

## Context
NERVA accepts human intent and may use an LLM to make that intent easier to express. An LLM is probabilistic and vulnerable to malformed context/prompt injection. NERVA may cause real financial actions.

## Decision
The LLM is an untrusted policy-proposal producer. Financial eligibility is decided only by deterministic structured policy validation, current admitted risk data, preflight/simulation and an external least-privilege signing/authorization boundary.

No free-form model output can directly authorize or parameterize a transaction without schema validation and exact policy-bound checks.

## Consequences
Positive: explainability, testability, replay, contained model failure.
Cost: more engineering and less unconstrained agent freedom.
Rejected: "agent decides and signs" as the core production architecture.
