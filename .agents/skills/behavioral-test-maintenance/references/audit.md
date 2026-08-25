# Audit Workflow

Audit maps test assets to stable behaviors and proposes maintenance; it never modifies the repository.

## Establish Scope and Evidence

1. Read the repository and nearest directory-specific `AGENTS.md` instructions.
2. Inspect relevant test scripts, framework configuration, fixtures, production surfaces, architecture contracts, accepted decisions, release criteria, and historical context needed to understand current intent.
3. Check repository status. Record overlapping user changes but do not alter them.
4. Inventory tests by behavior area and test layer. Counts and similarity searches are discovery aids, not conclusions.
5. Run existing tests only when useful for a read-only baseline and permitted by repository instructions. Do not install dependencies, update artifacts, or create persistent outputs.

Prefer current authoritative contracts and accepted decisions over historical implementation. Use issue or commit history to clarify why a regression exists, not to override the current specification silently.

## Build a Behavior Guarantee Ledger

For each behavior in scope, record:

- behavior ID and concise invariant;
- authoritative source or evidence;
- owning package, surface, and suite;
- preconditions/state, stimulus, and observable result;
- relevant fault classes;
- current unit, integration, contract, and end-to-end witnesses;
- unique boundary or environment covered by each witness;
- risk and confidence.

Tests with no identifiable current behavior are investigation candidates, not automatic deletion candidates.

## Decide Whether Coverage Is Duplicate

Treat test A as subsumed by surviving test B only when all of the following hold:

1. B protects the same contract or a stronger invariant.
2. B covers A's relevant preconditions and input partition, either deterministically or by a logically sufficient property.
3. B observes every distinguishing outcome asserted by A.
4. B executes across every boundary needed to expose A's fault class.
5. Removing A leaves useful failure localization and a stable oracle.
6. A adds no unique regression anchor, platform case, security boundary, lifecycle state, error translation, persistence effect, or compatibility guarantee.

Passing suites, shared source lines, identical output, or similar Arrange/Act/Assert code do not prove subsumption.

For cross-layer duplication, assign one canonical owner of the full behavior matrix. Consumer layers should normally retain representative wiring or conformance witnesses and adapter-specific assertions. Keep a full consumer matrix only when each data partition can independently fail in that consumer layer.

## Choose the Appropriate Test Form

| Form          | Prefer when                                                                                                  | Retain named examples when                                                                                     |
| ------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Parameterized | Setup, execution path, oracle, and failure meaning are homogeneous; only data partitions vary                | A case needs different setup, assertions, or explanation                                                       |
| Property      | A general invariant has a valid domain, independent oracle, deterministic reproduction, and useful shrinking | Boundaries, canonical examples, security regressions, or past counterexamples are not guaranteed by generation |
| Contract      | A stable public or cross-package boundary needs one canonical owner and consumer conformance witnesses       | A consumer adds unique translation, serialization, persistence, or wiring behavior                             |
| Regression    | A past defect represents a distinct risk partition or remains the clearest deterministic counterexample      | No stronger invariant deterministically protects the same failure                                              |

Do not create a property test merely because many examples exist. First state the invariant and show that the generator and oracle can falsify it meaningfully.

## Identify Maintenance Candidates

Look for:

- duplicate behavioral coverage or weaker tests subsumed by stronger ones;
- repeated homogeneous setup and assertions suitable for tables or builders;
- examples that genuinely express one general invariant;
- full input matrices repeated across unit, integration, contract, and end-to-end layers;
- assertions tied to private structure, exact class identity, incidental call order, or non-contract interactions;
- mock-heavy tests that reproduce implementation rather than observe outcomes;
- obsolete regressions and tests for behavior no longer specified;
- fragmented files without distinct behavior ownership;
- broad scenarios combining unrelated guarantees and harming fault localization;
- fixtures whose consolidation would reduce repetition without hiding important setup;
- production APIs apparently exposed only for tests.

Also record deliberate retention decisions. One-test files, interaction assertions, and repeated boundary witnesses may be correct when they own a distinct behavior.

## Risk Classification

Default to high risk for security, data loss or purge, migrations, persistence, concurrency or single-flight behavior, interruption, rollback and cleanup, platform behavior, localization and compatibility, IPC or serialized error contracts, and release-critical vertical slices.

Treat cross-package contract corpus changes and public authoring diagnostics as at least medium risk. Pure fixture cleanup with unchanged assertions is usually lower risk, subject to repository context.

## Audit Deliverable

Report:

1. Scope, sources of truth, repository state, and baseline limitations.
2. Behavior guarantee ledger or a compact equivalent.
3. Retain/defer findings with reasons.
4. Candidate findings using stable IDs. For each candidate include:
   - owning behavior;
   - current overlap or maintenance problem;
   - proposed merge, parameterize, property, rewrite, move, fixture consolidation, or deletion;
   - evidence of subsumption when deletion is proposed;
   - surviving guarantees and surviving tests;
   - risk, uncertainty, and verification plan.
5. High-risk items that should not be automated.
6. A request for a later user message confirming candidate IDs or a clearly defined group.

Do not edit during Audit, even if every candidate appears safe.
