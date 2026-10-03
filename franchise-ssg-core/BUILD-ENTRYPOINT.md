# Preview build entrypoint repair — 2026-09-13

The public UI remains locked at **v11.52**. This change does not redesign pages,
change franchise data, alter search-index policy, or approve a production release.

## Fixed regression

The old npm commands ended at v11.36, while the preview workflow built through
v11.52. Following the former README command could recreate obsolete output.
Use the explicit, guarded preview entrypoints instead:

```bash
npm --prefix franchise-ssg-core run plan
npm --prefix franchise-ssg-core test
npm --prefix franchise-ssg-core run build:preview
npm --prefix franchise-ssg-core run validate:preview
```

`plan` only prints the command list; it does not generate or publish files.
`build:preview` and `generate:preview` both run the complete validated preview
sequence. `validate:preview` checks the current RC and inherited contracts, not
superseded historical markup. Existing validators may refresh audit reports;
it is not a byte-preserving read-only operation.

## Historical compatibility

Historical validators inspect the literal old command strings in package.json.
Those strings are retained unchanged for the v11.37 baseline orchestration.
The `prebuild`, `pregenerate`, and `prevalidate` npm lifecycle hooks intentionally
stop legacy npm commands with the correct replacement command, before any stage
can run. Do not bypass these guards with `--ignore-scripts`, and do not copy and
execute the obsolete command strings directly. Use the explicit `:preview` commands.
The new regression tests check both the latest pipeline and the blocking hooks.

## Safety and reproducibility

- v11.37 generates the v11.3-v11.36 baseline exactly once. Do not prepend the old build.
- Preview mode, base path, and site URL remain locked to the GitHub Pages preview.
- Conflicting preview settings or a production approval flag fail before execution.
- All expected scripts must exist before any stage starts.
- Each command runs directly with Node from the repository root and stops on failure.
- Regression tests compare all 77 commands with the existing preview workflow.
- The entrypoint workflow has read-only repository permission; it neither commits
  generated HTML nor deploys anything.

The v11.53 authority/cleanup/handoff postpass remains separate and unchanged.
Actual production candidate generation and deployment retain their existing two
explicit user-approval gates in `PRODUCTION-HANDOFF.md`.
