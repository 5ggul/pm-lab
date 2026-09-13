# Preview build entrypoint repair — 2026-09-13

The public UI remains locked at **v11.52**. This change does not redesign pages,
change franchise data, alter search-index policy, or approve a production release.

## Fixed regression

The old `package.json` commands ended at v11.36 even though the preview workflow
built through v11.52. Following the README's `npm run build` command could therefore
recreate obsolete output. The default entrypoints now use the same audited,
single-pass sequence as `.github/workflows/franchise-ssg-preview.yml`.

```bash
npm --prefix franchise-ssg-core run plan
npm --prefix franchise-ssg-core test
npm --prefix franchise-ssg-core run build
npm --prefix franchise-ssg-core run validate
```

`plan` only prints the command list; it does not generate or publish files.
`build` and `generate` both run the complete validated preview sequence.
`validate` checks the current RC and inherited contracts, not superseded historical
markup. Existing validators may refresh audit reports; it is not a byte-preserving
read-only operation.

## Safety and reproducibility

- v11.37 generates the v11.3-v11.36 baseline exactly once. Do not prepend the old build.
- Preview mode, base path, and site URL are locked to the existing GitHub Pages preview.
- Conflicting preview settings or a production approval flag fail before execution.
- All expected scripts must exist before any stage starts.
- Each command runs directly with Node from the repository root and stops on failure.
- Regression tests compare the full command order with the existing preview workflow.
- The additional entrypoint workflow has read-only repository permission; it neither
  commits generated HTML nor deploys anything.

The v11.53 authority/cleanup/handoff postpass remains separate and unchanged.
Actual production candidate generation and deployment retain their existing two
explicit user-approval gates in `PRODUCTION-HANDOFF.md`.
