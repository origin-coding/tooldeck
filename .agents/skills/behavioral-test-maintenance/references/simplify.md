# Simplify Workflow

Simplify is available only after a separate user message confirms candidates from a completed Audit.

## Preflight

1. Verify that the confirmation maps unambiguously to audited candidate IDs or a bounded group. Ask instead of guessing when it does not.
2. Recheck repository status and preserve unrelated user changes. Stop on unsafe overlap.
3. Re-read the relevant contracts, tests, and production surfaces when they changed or the audit may be stale.
4. Run an appropriate focused baseline when feasible. If failures or flakiness prevent comparison, stop and report them.
5. Confirm that planned edits affect only tests or dedicated test infrastructure and were included in the audited scope.

If any preflight assumption materially changed, return to Audit without modifying files.

## Execute Confirmed Transformations

Work in small, coherent batches. Preserve test names that state observable behavior and keep setup explicit enough to understand failures.

Allowed confirmed transformations include:

- merge or move tests under a clearer behavior owner;
- replace homogeneous examples with named parameterized rows;
- replace repeated construction with focused builders or fixtures;
- rewrite implementation-detail assertions around stable observable outcomes;
- replace examples with a property when the invariant, generator, oracle, reproduction, and shrinking strategy are sound;
- reduce consumer matrices to boundary witnesses while retaining the canonical owner matrix;
- delete a test only after proving its guarantee survives elsewhere.

Do not force heterogeneous scenarios into one table. Avoid conditional branches in parameterized test bodies; if rows require materially different setup or assertions, keep separate tests.

Consolidate fixtures within the narrowest useful ownership boundary. Do not introduce a cross-package test framework merely to remove visible repetition.

## Deletion Proof

Before deleting any test, record in working notes:

- the exact behavior and fault class it protected;
- the surviving test or property;
- why the survivor observes the same defect across the necessary boundary;
- any named regression input moved into the survivor;
- the verification that will demonstrate preservation.

Do not delete when the proof depends only on a green suite, code coverage, shared implementation, or a generator that might never produce the regression input.

For high-risk deletion, prefer a targeted counterfactual or mutation that breaks the protected behavior and confirm that the surviving test fails. Mutation testing is optional supporting evidence, not a substitute for behavior analysis. Do not add mutation tooling or dependencies unless that exact change was audited and confirmed.

## Property-Based Tests

Require:

- a stated invariant with a bounded valid input domain;
- an oracle independent of the implementation under test;
- deterministic reproduction information such as a seed and shrunk counterexample;
- generators that deliberately cover critical partitions or retained deterministic anchors for them;
- reasonable runtime and failure diagnostics;
- a direct project dependency rather than reliance on a transitive package.

Keep named boundary, security, compatibility, and historical counterexamples when generation does not guarantee them.

## Verification

After each coherent batch:

1. Run the directly affected tests.
2. Run the owning package suite.
3. Run affected consumer or integration suites when a shared contract, fixture corpus, adapter, or boundary changed.
4. Run broader repository checks in proportion to the change and repository instructions.
5. Inspect the diff for accidental production changes, expected-value drift, hidden setup, weakened assertions, and unrelated formatting.
6. Compare the before/after behavior guarantee ledger. Every important guarantee must still have an identified owner and witness.

When a test fails because the proposed simplification changes behavior or specification, revert only the agent-owned uncommitted edit if safely attributable, retain the original test, and report the conflict. Never update the expected value merely to make the simplified suite pass.

## Stop and Re-Audit

Stop before expanding scope when:

- a new deletion or rewrite candidate appears;
- a dependency, production change, generated artifact update, or framework migration becomes necessary;
- a surviving test does not fail under the expected counterfactual;
- failure localization becomes materially worse;
- the confirmed transformation exposes conflicting specifications;
- required verification cannot run.

New candidates require a new Audit and another user confirmation.

## Handoff

Report:

- confirmed candidate IDs completed, deferred, or rejected;
- files and behavior owners changed;
- transformations made and tests deleted, if any;
- surviving guarantees and their witnesses;
- verification commands and results;
- unresolved uncertainty, high-risk retained tests, and any newly discovered candidates awaiting audit.

Do not claim success using test-count or line-count reduction as the primary result.
