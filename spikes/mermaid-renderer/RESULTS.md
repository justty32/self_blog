# Mermaid renderer spike result

- Date: 2026-08-17
- Decision: **GO** for later Astro integration
- Renderer profile: `self-blog-mermaid-v1`

## Selection

- Official `mermaid@11.16.1` bundle; no custom diagram parser or layout engine.
- `puppeteer-core@25.7.0` drives an existing Chrome／Edge／Chromium only during
  build. The npm install does not contain or download a browser binary.
- The browser page is offline and aborts every page request. Mermaid uses
  `securityLevel: "strict"` and SVG text labels rather than `foreignObject`.
- Output is normalized to a single inert SVG whose filename is the SHA-256 of
  its exact bytes. No browser or Mermaid runtime is copied to the site.

## Reader-facing result

| Fixture | SVG bytes | JavaScript／runtime assets | SHA-256 filename |
|---|---:|---:|---|
| `valid-flowchart` | 15,088 | 0 | `24c73c227025c569e7c83375ed397036f3fd601742db94fc12d0c5e25d81d6a0.svg` |
| `unsafe-link-probe` | 12,508 | 0 | `c74d857a9025663b259dc531156a82e5162c09d664c3b9f5dd05eeaceffdafaf.svg` |

Both are below the frozen 100 KiB limit. The second source deliberately contains
an external click target; the accepted SVG retains its visible labels but no
navigable or remote reference.

This proves the renderer boundary, not yet the whole site. The later
`verify:dist` must still prove that every deployed page has zero client JS and
no accidental build dependency.

## Build-only cost

Measured on Node `v24.16.0`, npm `11.13.0`, Windows, and Chrome
`151.0.7922.138`:

| Measurement | Result |
|---|---:|
| `node_modules` | 157,267,470 bytes／11,654 files |
| injected Mermaid build bundle | 3,566,058 bytes |
| three isolated valid renders | 2,934 ms／1,314 ms／2,234 ms |
| generated SVG each run | identical 15,088 bytes |
| npm audit | 0 vulnerabilities |

These build files stay in the developer／CI environment. They are not visitor
downloads. GitHub's hosted Ubuntu 24.04 image currently includes Google Chrome;
the renderer also accepts an explicit `PUPPETEER_EXECUTABLE_PATH`:
<https://github.com/actions/runner-images/blob/main/images/ubuntu/Ubuntu2404-Readme.md>.

## Verification evidence

```text
npm run test:gate
MERMAID_SPIKE_GATE_SELF_TEST_PASS 68 assertions

npm run verify:spike
MERMAID_SPIKE_PASS
```

The acceptance command renders both valid cases twice in fresh subprocesses
and distinct temp directories, then compares filename and bytes. It also proves:

- exact title, description, ARIA references, dimensions, viewBox and expected
  visible labels;
- no script, event handler, external URL, embedded media, interaction CSS or
  animation;
- content-addressed filename and raw size limit;
- missing `accTitle`, missing `accDescr` and invalid Mermaid syntax exit 65
  without leaving output;
- complete lock audit: 144 instances, 1 exact pinned-license evidence record,
  and 0 missing／unknown／denied licenses.

The committed candidate lock SHA-256 is
`6eea1023ea58c4d93e0c700f8ec1456c95da2eafd1b4a47ae9b4828c0c87dc51`,
matching [ADR-0001](../../docs/plan/adr/0001-mermaid-profile-b-evidence.md).

## Determinism boundary

The frozen gate guarantees identical bytes for isolated renders within one
toolchain environment. It does not promise that different browser or system-font
versions have identical layout. That variation is safe because the filename
hashes the produced bytes, but a future render cache must include all of:

- diagram source and theme diagram tokens;
- exact Mermaid version;
- renderer profile (configuration, sanitization and serialization policy);
- browser product/version;
- font-metric fingerprint.

This run recorded environment fingerprint
`f1285afc1c43e12de3f7ddf3fa96ff57349dcacff3c6796ea7f48ac14ab526ce`.
A browser/font change is a cache miss and a rebuild, not a reason to reuse stale
SVG bytes.
