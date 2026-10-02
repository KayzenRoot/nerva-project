# NERVA Definition of Done

Status: CANONICAL — NERVA-WO-001

## Work Order Done
A Work Order is done only when:
- all admitted acceptance criteria are objectively evidenced;
- exact base/head are recorded;
- code/docs/tests agree;
- required lint/typecheck/build/tests/security checks pass;
- no unresolved CRITICAL/HIGH introduced finding exists;
- Evidence Bundle exists;
- audit verdict is APPROVED;
- affected canonical truth is promoted through an audited Checkpoint Delta;
- PR is merged and post-merge checks are green where applicable.

"Completed" by an executor is not evidence.

## V0.1 Product Done
- M00-M06 NECESSARY obligations are approved.
- Core end-to-end path works without hidden manual intervention.
- NERVA remains non-custodial.
- Deterministic risk/policy/execution safety is proven.
- Perpl primary flow is integrated or an explicit BLOCKED decision changes scope before submission.
- Wallet/signing integration is least-privilege and demonstrably bounded.
- Evidence/Flight Recorder explains trigger, policy, plan, preflight and outcome.
- Demo simulator is isolated from production execution.
- Deployment is healthy and reproducible.
- Required security/adversarial/recovery tests pass.
- README and operator/deployment docs match the artifact.
- Metropolis submission package is complete and deadline verified.
- Monetization shown in product/pitch is transparent and does not rely on user harm.

## Metropolis Submission Done
- registration/submission portal requirements reverified;
- selected track and sponsor bounties are eligibility-checked;
- deployed/demo URL works;
- repository visibility choice satisfies rules;
- video/pitch/demo assets work from a clean session;
- project description states what is actually implemented;
- no unimplemented future feature is presented as shipped;
- submission receipt/screenshot/reference is preserved in evidence.

## Version complete
V0.1 is declared complete only after the final M06 audit confirms all applicable V0.1 DoD items.
