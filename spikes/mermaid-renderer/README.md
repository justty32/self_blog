# Mermaid renderer spike

This spike chooses and proves a build-time Mermaid-to-SVG renderer before the
Astro site is scaffolded.

The acceptance contract lives in `gate/`. Its XML, CSS, and SPDX parsing is
delegated to established modules; the local code only expresses this site's
policy. The gate and its fixtures are committed before any renderer
implementation. An implementation commit may add the official Mermaid-based
renderer, its pinned dependencies, configuration, and evidence, but must not
modify `gate/` or `fixtures/`.

Gate self-test (must pass before a renderer exists):

```text
npm run test:gate --prefix spikes/mermaid-renderer
```

Spike acceptance (intentionally fails with `RENDERER_MISSING` in the gate-only
commit):

```text
npm run verify:spike --prefix spikes/mermaid-renderer
```

The gate proves only the renderer boundary: deterministic, content-addressed,
accessible, inert SVG with no client runtime, plus a profile-B npm license
inventory. The later site-wide `verify:dist` remains responsible for proving
that the complete GitHub Pages artifact is zero-JavaScript.

The verifier observes the renderer's isolated temporary working directory and
requested output directory, but it is not an operating-system sandbox. It does
not claim that arbitrary renderer code lacks filesystem or build-time network
access. The implementation remains trusted, pinned build tooling and must
separately disable browser requests; the final SVG gate ensures that no remote
reference reaches readers.

## Selected implementation

The passing spike uses the official `mermaid@11.16.1` browser bundle through
`puppeteer-core@25.7.0`. It reuses an installed Chrome, Edge, or Chromium and
does not download a browser from npm; CI may set `PUPPETEER_EXECUTABLE_PATH`.
The page is placed offline, every page request is aborted, and the result is
normalized to one inert, accessible, content-addressed SVG.

Mermaid, Puppeteer, the browser, and their dependencies are build tools only.
They are never copied to the site. In the accepted fixtures the reader-facing
files are 12.5–15.1 kB SVGs with zero runtime JavaScript. See [RESULTS.md](RESULTS.md)
for the measured evidence and the precise determinism boundary.
