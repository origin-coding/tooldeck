---
name: gh-clean-merged-branch
description: Safely clean local and remote Git feature branches after their GitHub pull requests are merged. Use when the user asks to clean the current branch, a named branch, or the latest merged feature branch, including squash-merged branches. Do not use for unmerged, merely closed, ambiguous, or unrelated branches.
---

# Clean a Merged GitHub Branch

Discover the target branch and its pull request dynamically, prove that the exact branch work is merged, update the pull request's base branch, remove the local and requested remote branch, prune stale references, and verify the result.

## Execution Requirements

- Run every `git` and `gh` command with elevated privileges from the first attempt. Do not try these commands in the sandbox first; this repository environment may reject even read-only Git operations without elevation.
- Include a concise approval justification whenever the execution tool requires one.
- Run discovery commands before mutation commands. Never infer merge state from local history alone.
- Treat remote branch deletion and forced local deletion as destructive operations. Perform them only when the user's request explicitly includes cleanup and every safety gate below passes.
- Use the repository working directory supplied by the user. Do not hardcode a repository path, branch name, pull request number, remote default branch, or base branch.

## 1. Discover the Repository State

Run these read-only checks with elevation:

```text
git status --short --branch
git branch --show-current
git branch --all --verbose --no-abbrev
git worktree list --porcelain
git symbolic-ref --short refs/remotes/origin/HEAD
```

Stop if the worktree contains tracked or untracked changes. Do not stash, discard, move, or commit them as part of branch cleanup.

Resolve the target as follows:

- Use a branch or pull request explicitly named by the user.
- Otherwise, if the current branch has a merged pull request, use that branch.
- If the user asks for the latest merged feature branch, query merged pull requests ordered by `mergedAt` and select the newest pull request whose `headRefName` is a feature branch.
- If multiple candidates remain plausible, report them and ask the user to choose. Do not delete any branch while the target is ambiguous.

For latest-branch discovery, run with elevation:

```text
gh pr list --state merged --limit 20 --json number,title,headRefName,baseRefName,mergedAt,url
```

## 2. Prove the Pull Request Was Merged

Query the selected pull request with elevation:

```text
gh pr view <pr-number> --json state,mergedAt,headRefName,baseRefName,mergeCommit,commits,url
```

Record these values from the result:

- `<feature-branch>` from `headRefName`
- `<base-branch>` from `baseRefName`
- `<pr-head-oid>` from the last item in `commits`
- `<merge-oid>` from `mergeCommit`

Require all of the following:

- `state` is exactly `MERGED`.
- `mergedAt` is present.
- `headRefName` exactly matches the target feature branch.
- `baseRefName` is present and differs from the feature branch.
- The target is not the remote default branch.
- The local feature branch, if it exists, points to `<pr-head-oid>`. Stop if it contains commits added after the merged pull request.
- The target branch is not checked out in another worktree.

Never treat `CLOSED` as `MERGED`.

## 3. Check the Live Remote Branch

Do not rely on a possibly stale `origin/<feature-branch>` tracking reference. Run with elevation:

```text
git ls-remote --heads origin refs/heads/<feature-branch> refs/heads/<base-branch>
```

Record whether the remote feature branch actually exists. Stop if the base branch cannot be found on the remote.

## 4. Update the Base Branch

Run each command with elevation:

```text
git switch <base-branch>
git pull --ff-only origin <base-branch>
```

Stop if switching fails or the pull cannot fast-forward. Never use reset, rebase, checkout-discard, or another destructive recovery operation as part of this workflow.

Confirm that the base branch now points to or contains `<merge-oid>` before deleting the feature branch.

## 5. Delete the Local Feature Branch

If the local feature branch exists, first run with elevation:

```text
git branch -d <feature-branch>
```

If safe deletion fails because the pull request was squash-merged, use the following only after all merge checks passed and the local branch still equals `<pr-head-oid>`:

```text
git branch -D <feature-branch>
```

Do not force-delete when the local branch differs from the merged pull request head.

## 6. Delete the Remote Feature Branch

Skip this step when the user requested local-only cleanup or the live remote check showed that the branch was already deleted.

Otherwise, run with elevation:

```text
git push origin --delete <feature-branch>
```

Do not delete a differently named remote branch, even if it appears related.

## 7. Prune and Verify

Run with elevation:

```text
git fetch --prune origin
git status --short --branch
git branch --all --list "*<feature-branch>*"
git ls-remote --heads origin refs/heads/<feature-branch>
git log -1 --oneline
```

Report success only when:

- The current branch is the updated `<base-branch>`.
- The worktree is clean.
- No local feature branch remains.
- No remote-tracking feature branch remains.
- The live remote feature branch is absent when remote cleanup was requested.
- The base branch contains the pull request merge result.

Include the pull request number, deleted branch, base branch, whether `-D` was required for a squash merge, and final verification results in the handoff.
