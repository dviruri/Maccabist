# Maccabist v0.7.1

## Purpose

A stabilization / release-hygiene patch on top of v0.7. No gameplay features, no rebalancing,
no new systems. The point is to make v0.7 safer to maintain and deploy while producing
effectively the identical game for the player.

## Changes

Four files. No file under `src/`, `tests/` or `scripts/` was touched.

**Version metadata.** `package.json` was still at `0.1.0` — seven releases stale. Set to
`0.7.1`, with both version fields in `package-lock.json` (top level and the root package entry)
synchronized. Historical `v0.x` references inside code comments and previous reports were left
alone; they are records of when things were built, not statements about the current release.

**CI now runs the tests before it deploys.** The workflow installed, built and deployed — a red
suite still shipped to production. `npm test` now runs between install and build, in the same
job, so a failing test stops the job before the artifact is ever uploaded and the live site keeps
its last good version.

Deliberately *not* added: a separate typecheck step. `npm test` is
`tsc -p tsconfig.test.json && vitest run` and `npm run build` is `tsc -b && vite build`, so both
TypeScript projects are already compiled by the two steps present — a third would be redundant.
The verification stays in one job with one `npm ci`; splitting it out would install dependencies
twice for no benefit.

**GitHub Actions runtime.** The deployment warning came from actions still running on Node 20.
Every action in the workflow was affected, verified by reading each `action.yml` rather than
assuming:

| action | was | runtime | now | runtime |
| --- | --- | --- | --- | --- |
| `actions/checkout` | v4 | node20 | **v5** | node24 |
| `actions/setup-node` | v4 | node20 | **v5** | node24 |
| `actions/configure-pages` | v5 | node20 | **v6** | node24 |
| `actions/upload-pages-artifact` | v4 | composite → `upload-artifact@4.6.2` (node20) | **v5** | → `upload-artifact@v7` |
| `actions/deploy-pages` | v4 | node20 | **v5** | node24 |

Each was moved to the *lowest* major that runs on node24, not to the newest tag available
(`checkout` is at v7, `setup-node` at v7). The v5 lines are actively maintained — `checkout@v5.1.0`
carries the same backported security fix as v4.4.0 — so this clears the warning without
absorbing two majors of unrelated behaviour change in a patch release. The documented breaking
changes in the newer majors all concern `pull_request_target` / fork-PR checkout, which this
workflow never does; that avenue stays available whenever it is wanted.

`node-version: 22` in `setup-node` was left as it was. The action's runtime and the project's
runtime are different things, and the application's Node version should not move to silence an
infrastructure warning.

**README.** One block added under the play link stating that v0.7.1 is the current stable
release and v0.8 is the next feature release. Nothing else rewritten.

No regression fix was required: nothing was found broken.

## Verification

```
npm ci            clean (109 packages)
npm test          1007 passed / 1007   (53 files)
npm run build     clean, /Maccabist/ base path intact in dist/index.html
git diff --check  clean
```

**Test count is unchanged from the v0.7 baseline of 1007/1007.** No test was added, removed,
skipped or filtered.

**Simulation regression** — 50,000 balanced careers against the V07_REPORT.md baseline:

```
                              v0.7      v0.7.1
reached Maccabi senior team    63.9%     63.9%
played abroad                  33.2%     33.2%
returned to Maccabi            21.3%     21.3%
had a loan spell               31.8%     31.8%
avg Legend Score                41.8      41.8
median Legend Score             34.0      34.0
avg peak ability                80.9      80.9
avg Maccabi appearances        132.6     132.6
mean retirement age             34.9      34.9
same seed reproduces career     PASS      PASS
different seeds diverge         PASS      PASS
```

Identical, which is the expected and only acceptable result: `git diff` touches no file the
engine loads, so the simulation is a pure function of unchanged bytes.

**Mobile smoke check** — headless Chrome, the page measuring itself, at 320/360/375/390/412/430:

```
scene           320  360  375  390  412  430
probe-canary     1    1    1    1    1    1     <- negative control, must fail
cabinet          0    0    0    0    0    0
album            0    0    0    0    0    0
journey          0    0    0    0    0    0
season           0    0    0    0    0    0
retirement       0    0    0    0    0    0
poster           0    0    0    0    0    0
```

Zero overflowing elements. The first pass of this audit ran with a wrong scene id for the
canary, so the control silently reported clean and the zeros meant nothing; re-run with
`probe-canary`, the control fails at every width as it must, which is what makes the zeros
measurements rather than decoration.

**v0.7 systems verified present and untouched:** Career Archive, Trophy Cabinet, Club Album,
Individual Honors, season award persistence, retirement archive creation and idempotency,
multiple archived careers, archive deletion not affecting the active career, career poster,
lower-division paths, youth/senior separation, the `youth_maccabi_netanya` regression fix,
position-aware awards, goalkeeper eligibility, and deterministic award RNG isolation — all
covered by the 1007 passing tests, and by `git diff HEAD -- src tests scripts` being empty.

**GitHub Pages workflow result:** not observable from here. The workflow triggers on push to
`main`; its first run under these changes will be the push of this commit. The workflow was
validated structurally instead (step order, single install, no `--passWithNoTests`, no
`continue-on-error`, no tabs, all five action versions).

## Gameplay impact

**None.** No gameplay or balance changes. No file under `src/`, `tests/` or `scripts/` was
modified; the four changed files are `package.json`, `package-lock.json`,
`.github/workflows/deploy.yml` and `README.md`. The UI is byte-identical.

## Observations, not fixed

Recorded rather than acted on, because a patch release is the wrong place for them:

- **`npm audit` reports 5 vulnerabilities (1 critical, 1 high, 3 moderate).** All are in the
  vite/vitest dev-tooling chain and concern the *development server* — an esbuild issue where a
  website can read dev-server responses, and a Vite path-traversal in dev optimized-deps
  handling. The deployed artifact is a static build and is unaffected. Clearing them requires
  major-version bumps of vite and vitest (`npm audit fix --force` warns of breaking changes),
  which is exactly the kind of change this release exists to avoid. Worth its own change.
- **README staleness beyond the version.** Several sections predate v0.6.2–v0.7 and now
  misdescribe the game: the intro still frames retirement around **מדד אגדה**, which stopped
  being a user-facing score in v0.6.2; "Not in this version" still says "no share card", which
  v0.7 shipped; "Known limitations" still says the second division has only two clubs (v0.6.4/
  v0.6.5 built the full pyramid) and that mobile layout is CSS-audited rather than
  browser-verified (it has been browser-verified since v0.6.5.1). Correcting these means
  rewriting prose across the file, which the brief for this release explicitly excludes.
- **Ligat Ha'Al playoff scheduling** remains the simplified 7-fixture allowance carried forward
  from v0.6.5.3.

## Deferred

**v0.8 — European Competitions** remains the next feature release and is not started. Nothing in
this patch touches the `continental_generic` classification or the reserved continental trophy
slot that v0.7 left for it.
