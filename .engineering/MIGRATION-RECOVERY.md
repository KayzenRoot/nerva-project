# NERVA Migration & Recovery

Status: CANONICAL_CANDIDATE — M00

## Principle
Application state can be rolled back; confirmed blockchain financial effects generally cannot. Recovery must distinguish software rollback from financial compensation/forward recovery.

## Schema/config migration
- version all persisted safety-critical schemas;
- migrations are explicit and tested;
- unknown major versions fail closed;
- policy hashes/versions remain reproducible after migration;
- backup/restore or export path is proven before destructive migration.

## Execution recovery
Effect states: NOT_STARTED, SUBMITTED, CONFIRMED, REFUSED, FAILED, UNKNOWN.
- FAILED before submission may be safely replanned if policy/data are fresh.
- UNKNOWN after possible submission must be reconciled with provider/chain state before any retry.
- CONFIRMED is immutable evidence; a later protective adjustment is a new policy-governed action, not rollback.

## Dependency outage
On stale/unavailable critical Perpl/wallet/indexer input: stop new autonomous financial actions and surface DEGRADED/STALE state. Monitoring may continue with clearly labeled incomplete data.

## Kill switch
Emergency pause blocks creation/authorization of new plans. It does not pretend to cancel already-confirmed transactions.

## Disaster recovery V0.1
Deployment/config/datastore recovery procedure must reproduce policy/evidence integrity from a known backup/export. Exact RPO/RTO are frozen before public production use; hackathon demo still requires a deterministic reset path.
