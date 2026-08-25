---
name: behavioral-test-maintenance
description: Audit existing tests for behavioral overlap, weak or obsolete coverage, implementation coupling, and safe consolidation opportunities. Use for dedicated test-suite governance and behavior-preserving test maintenance, not routine feature-test creation, failing-test repair, flaky-test diagnosis, or production-code refactoring. The first invocation is always read-only; changes require a separate user confirmation after the audit.
---

# Behavioral Test Maintenance

Improve behavioral coverage density without weakening important guarantees. Treat tests as maintainable specifications: they may be merged, parameterized, rewritten, moved, or deleted only when their behavior protection remains explicit and demonstrably covered.

## Mandatory Two-Turn Gate

The first user message that activates this skill always starts Audit, even when it asks to edit immediately or says to audit and simplify in one pass.

During that first turn:

- Make no tracked or untracked repository changes.
- Do not edit tests, fixtures, configuration, snapshots, expected output, dependencies, or production code.
- Do not install tools or run commands that update generated artifacts.
- Read [references/audit.md](references/audit.md) completely and produce a read-only audit.
- Give every proposed change a stable candidate ID such as `BTM-001`.
- End by asking the user to confirm specific candidate IDs or a clearly bounded candidate group in a later message.

Initial permission to "go ahead," "make the changes," or similar never satisfies the second-turn gate. A valid confirmation must come after the audit in a new user message and identify the proposed scope; when only one unambiguous candidate exists, a later "continue" is sufficient.

After valid confirmation:

- Read [references/simplify.md](references/simplify.md) completely before editing.
- Recheck repository state and audit assumptions.
- Modify only the confirmed candidates.
- Treat materially expanded or newly discovered changes as a new Audit requiring another confirmation.

If the conversation does not contain a current audit with identifiable candidates, run Audit again instead of editing.

## Scope Boundaries

- Keep production code read-only. Report production APIs exposed only for testing or production refactors that could improve testability as separate follow-up work.
- Restrict confirmed changes to tests and dedicated test infrastructure. A dependency or test-configuration change must have appeared in the confirmed audit scope.
- Do not change specification, public behavior, error semantics, persistence semantics, or release guarantees to make simplification possible.
- Do not update expected values merely because the current implementation differs.
- Do not optimize for test count, file count, lines of code, coverage percentage, or a fixed consolidation target.
- Do not use code coverage, passing tests, source-line overlap, or syntactic similarity alone as evidence that a test is redundant.
- Do not turn this workflow into ordinary feature-test authoring, failing-test repair, flaky-test diagnosis, framework migration, or production cleanup.

## Behavioral Standard

Identify coverage by a behavior signature:

```text
contract or invariant owner
+ actor or callable surface
+ relevant preconditions and state
+ stimulus
+ observable oracle
+ failure class detected
+ boundary or test layer
```

Tests cover the same behavior only when these dimensions match or one test demonstrably subsumes the other. A lower-layer test does not replace an integration witness when the defect can occur in wiring, serialization, persistence, lifecycle, or another crossed boundary.

Prefer the lowest layer that can reliably observe a behavior. Keep higher layers focused on their own wiring, integration, contract, and end-to-end guarantees rather than replaying an owner's complete input matrix.

## Non-Negotiable Stop Conditions

Stop without modifying, or stop the confirmed edit and report, when:

- the owning behavior or source of truth is unclear or conflicting;
- deletion would remove the only observation of a boundary, failure class, platform, migration, security rule, concurrency rule, cleanup/rollback path, compatibility rule, or release-critical flow;
- the baseline is failing or flaky in a way that prevents before/after comparison;
- the proposed oracle derives expected behavior from the implementation under test;
- parameterization or consolidation would obscure test meaning or failure localization;
- a property generator cannot guarantee critical boundaries or use an independent oracle;
- the change needs production edits, an unconfirmed dependency, or a materially broader scope;
- relevant verification cannot be run;
- overlapping user changes make safe attribution impossible.

When uncertain whether a test carries independent business meaning, retain it and report the uncertainty.
