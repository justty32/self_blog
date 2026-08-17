import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  LicenseGateError,
  assertNoShrinkwrap,
  auditPackageFiles,
  auditPackageLock,
  evaluateProfileB,
} from "./license.mjs";
import { MAX_SVG_BYTES, SvgGateError, inspectSvg } from "./svg.mjs";
import {
  SpikeGateError,
  assertDeterministic,
  readSingleSvg,
} from "./verify.mjs";

const expected = Object.freeze({
  title: "發文流程",
  description: "草稿經過檢查、建置，最後部署。",
  expectedText: ["草稿", "檢查", "建置", "部署"],
});

const safeSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100" viewBox="0 0 200 100" role="img" aria-labelledby="diagram-title diagram-desc">
<title id="diagram-title">發文流程</title>
<desc id="diagram-desc">草稿經過檢查、建置，最後部署。</desc>
<style>:root{--mermaid-font-family:"trebuchet ms",sans-serif}.node{fill:#fff}.edge{marker-end:url(#arrow)}</style>
<defs><marker id="arrow"><path d="M0 0L5 5L0 10z"/></marker></defs>
<path class="edge" marker-end="url(#arrow)" d="M0 0L10 10"/>
<text class="node">草稿 檢查 建置 部署</text>
</svg>`;

let assertions = 0;

function contentFilename(bytes) {
  return `${createHash("sha256").update(bytes).digest("hex")}.svg`;
}

function inspect(source, filename = undefined) {
  const bytes = Buffer.from(source, "utf8");
  return inspectSvg(bytes, filename ?? contentFilename(bytes), expected);
}

function expectError(ErrorClass, code, callback) {
  assert.throws(callback, (error) => error instanceof ErrorClass && error.code === code);
  assertions += 1;
}

async function expectAsyncError(ErrorClass, code, callback) {
  await assert.rejects(callback, (error) => error instanceof ErrorClass && error.code === code);
  assertions += 1;
}

function replace(search, replacement) {
  assert.ok(safeSvg.includes(search), `Self-test mutation target is missing: ${search}`);
  return safeSvg.replace(search, replacement);
}

function testLicenseExpressions() {
  assert.equal(evaluateProfileB("MIT").witness, "MIT");
  assert.match(evaluateProfileB("MIT AND ISC").normalized, /MIT AND ISC/u);
  assert.equal(evaluateProfileB("MIT OR GPL-3.0-only").witness, "MIT");
  assertions += 3;

  expectError(LicenseGateError, "NOT_ALLOWLISTED", () => evaluateProfileB("MIT AND GPL-3.0-only"));
  expectError(LicenseGateError, "UNKNOWN_SPDX_ID", () => evaluateProfileB("MIT OR MadeUp-1.0"));
  expectError(LicenseGateError, "UNRESOLVED_LICENSE_REF", () => evaluateProfileB("LicenseRef-Local"));
  expectError(LicenseGateError, "LICENSE_EXCEPTION_NOT_ALLOWED", () =>
    evaluateProfileB("GPL-2.0-only WITH Classpath-exception-2.0"),
  );
  expectError(LicenseGateError, "INVALID_SPDX", () => evaluateProfileB("MIT OR"));
}

function makeLock() {
  const packageJson = {
    name: "gate-self-test",
    version: "0.0.0",
    license: "MIT",
    devDependencies: { direct: "1.0.0" },
  };
  const lockfile = {
    name: "gate-self-test",
    version: "0.0.0",
    lockfileVersion: 3,
    requires: true,
    packages: {
      "": {
        name: "gate-self-test",
        version: "0.0.0",
        license: "MIT",
        devDependencies: { direct: "1.0.0" },
      },
      "node_modules/direct": {
        version: "1.0.0",
        license: "MIT OR GPL-3.0-only",
        dev: true,
      },
      "node_modules/direct/node_modules/transitive": {
        version: "2.0.0",
        license: "ISC",
        dev: true,
        optional: true,
      },
    },
  };
  return { packageJson, lockfile };
}

function testLockAudit() {
  const { packageJson, lockfile } = makeLock();
  const inventory = auditPackageLock(lockfile, packageJson, "synthetic lock");
  assert.equal(inventory.summary.verdict, "pass");
  assert.equal(inventory.summary.instances, 3);
  assert.equal(inventory.summary.direct, 1);
  assert.equal(inventory.summary.transitive, 1);
  assertions += 4;

  const mutate = (callback) => {
    const copy = structuredClone(makeLock());
    callback(copy);
    return copy;
  };
  let changed = mutate(({ lockfile: value }) => delete value.packages["node_modules/direct"].license);
  expectError(LicenseGateError, "MISSING_LICENSE", () =>
    auditPackageLock(changed.lockfile, changed.packageJson),
  );
  changed = mutate(({ lockfile: value }) => {
    value.packages[""].devDependencies.direct = "2.0.0";
  });
  expectError(LicenseGateError, "STALE_LOCKFILE", () =>
    auditPackageLock(changed.lockfile, changed.packageJson),
  );
  changed = mutate(({ lockfile: value }) => {
    value.packages["node_modules/direct"].link = true;
  });
  expectError(LicenseGateError, "UNSUPPORTED_LOCAL_SOURCE", () =>
    auditPackageLock(changed.lockfile, changed.packageJson),
  );
  changed = mutate(({ lockfile: value }) => {
    value.lockfileVersion = 2;
  });
  expectError(LicenseGateError, "LOCKFILE_VERSION", () =>
    auditPackageLock(changed.lockfile, changed.packageJson),
  );
}

function testSafeSvg() {
  const result = inspect(safeSvg);
  assert.equal(result.width, 200);
  assert.equal(result.height, 100);
  assert.equal(result.title, expected.title);
  assertions += 3;

  const localXlink = replace(
    "</svg>",
    '<use xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="#arrow"/></svg>',
  );
  assert.equal(inspect(localXlink).title, expected.title);
  assertions += 1;

  const baseBytes = Buffer.byteLength(safeSvg, "utf8");
  const atLimit = `${safeSvg}${" ".repeat(MAX_SVG_BYTES - baseBytes)}`;
  assert.equal(inspect(atLimit).bytes, MAX_SVG_BYTES);
  assertions += 1;
  expectError(SvgGateError, "SVG_TOO_LARGE", () => inspect(`${atLimit} `));
}

function testSvgRejections() {
  expectError(SvgGateError, "FORBIDDEN_ELEMENT", () =>
    inspect(replace("</svg>", "<ScRiPt>alert(1)</ScRiPt></svg>")),
  );
  expectError(SvgGateError, "FORBIDDEN_ELEMENT", () =>
    inspect(replace("</svg>", '<evil:script xmlns:evil="http://www.w3.org/2000/svg"/></svg>')),
  );
  expectError(SvgGateError, "EVENT_ATTRIBUTE", () =>
    inspect(replace("<svg ", '<svg onload="alert(1)" ')),
  );
  expectError(SvgGateError, "EXTERNAL_REFERENCE", () =>
    inspect(replace("</svg>", '<use href="javascript:alert(1)"/></svg>')),
  );
  expectError(SvgGateError, "EXTERNAL_REFERENCE", () =>
    inspect(replace("</svg>", '<use href="java&#x73;cript:alert(1)"/></svg>')),
  );
  expectError(SvgGateError, "EXTERNAL_REFERENCE", () =>
    inspect(replace("</svg>", '<use href="https://example.com/x.svg"/></svg>')),
  );
  expectError(SvgGateError, "EXTERNAL_REFERENCE", () =>
    inspect(replace("</svg>", '<use href="relative.svg"/></svg>')),
  );
  expectError(SvgGateError, "XML_BASE", () =>
    inspect(
      replace("</svg>", '<use href="#arrow"/></svg>').replace(
        "<svg ",
        '<svg xml:base="https://example.test/" ',
      ),
    ),
  );
  expectError(SvgGateError, "FOREIGN_ATTRIBUTE_NAMESPACE", () =>
    inspect(
      replace(
        'role="img" aria-labelledby="diagram-title diagram-desc"',
        'xmlns:x="urn:spoof" x:role="img" x:aria-labelledby="diagram-title diagram-desc"',
      ),
    ),
  );
  expectError(SvgGateError, "EXTERNAL_REFERENCE", () =>
    inspect(replace("fill:#fff", "fill:url(https://example.com/a.svg)")),
  );
  expectError(SvgGateError, "EXTERNAL_REFERENCE", () =>
    inspect(
      replace(
        '--mermaid-font-family:"trebuchet ms",sans-serif',
        "--mermaid-font-family:url(https://example.com/font.woff2)",
      ),
    ),
  );
  expectError(SvgGateError, "CSS_ESCAPED_URL", () =>
    inspect(replace("fill:#fff", "fill:u\\72l(https://example.com/a.svg)")),
  );
  expectError(SvgGateError, "CSS_AT_RULE", () =>
    inspect(replace(".node{fill:#fff}", '@import "https://example.com/a.css";')),
  );
  expectError(SvgGateError, "FORBIDDEN_ELEMENT", () =>
    inspect(replace("</svg>", "<foreignObject/></svg>")),
  );
  expectError(SvgGateError, "FORBIDDEN_ELEMENT", () =>
    inspect(replace("</svg>", '<image href="#arrow"/></svg>')),
  );
  expectError(SvgGateError, "TITLE_COUNT", () =>
    inspect(replace('<title id="diagram-title">發文流程</title>\n', "")),
  );
  expectError(SvgGateError, "TITLE_MISMATCH", () =>
    inspect(replace("<title id=\"diagram-title\">發文流程</title>", '<title id="diagram-title"></title>')),
  );
  expectError(SvgGateError, "DESCRIPTION_COUNT", () =>
    inspect(replace('<desc id="diagram-desc">草稿經過檢查、建置，最後部署。</desc>\n', "")),
  );
  expectError(SvgGateError, "DESCRIPTION_MISMATCH", () =>
    inspect(
      replace(
        '<desc id="diagram-desc">草稿經過檢查、建置，最後部署。</desc>',
        '<desc id="diagram-desc"></desc>',
      ),
    ),
  );
  expectError(SvgGateError, "A11Y_REFERENCE", () =>
    inspect(replace('aria-labelledby="diagram-title diagram-desc"', 'aria-labelledby="diagram-desc diagram-title"')),
  );
  expectError(SvgGateError, "DUPLICATE_ID", () =>
    inspect(replace("</svg>", '<g id="arrow"/></svg>')),
  );
  expectError(SvgGateError, "INVALID_DIMENSION", () =>
    inspect(replace('width="200" ', "")),
  );
  expectError(SvgGateError, "INVALID_DIMENSION", () =>
    inspect(replace('width="200"', 'width="0"')),
  );
  expectError(SvgGateError, "INVALID_DIMENSION", () =>
    inspect(replace('width="200"', 'width="100%"')),
  );
  expectError(SvgGateError, "INVALID_VIEWBOX", () =>
    inspect(replace('viewBox="0 0 200 100"', 'viewBox="0 0 200"')),
  );
  expectError(SvgGateError, "ASPECT_RATIO", () =>
    inspect(replace('width="200"', 'width="300"')),
  );
  expectError(SvgGateError, "MISSING_FRAGMENT", () =>
    inspect(replace("url(#arrow)", "url(#missing)")),
  );
  expectError(SvgGateError, "CSS_MOTION", () =>
    inspect(replace("fill:#fff", "fill:#fff;animation:pulse 1s infinite")),
  );
  expectError(SvgGateError, "CSS_INTERACTION", () =>
    inspect(replace(".node{fill:#fff}", ".node:hover{fill:#fff}")),
  );
  expectError(SvgGateError, "FORBIDDEN_ELEMENT", () =>
    inspect(replace("</svg>", '<animate attributeName="x"/></svg>')),
  );
  expectError(SvgGateError, "FORBIDDEN_ELEMENT", () =>
    inspect(replace("</svg>", "<discard/></svg>")),
  );
  expectError(SvgGateError, "DOCTYPE_FORBIDDEN", () =>
    inspect(`<!DOCTYPE svg>${safeSvg}`),
  );
  expectError(SvgGateError, "MALFORMED_XML", () =>
    inspect(replace("</svg>", "")),
  );

  const bytes = Buffer.from(safeSvg, "utf8");
  expectError(SvgGateError, "HASH_FILENAME", () => inspectSvg(bytes, "wrong.svg", expected));
}

async function testOutputContract() {
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "self-blog-gate-test-"));
  try {
    const empty = path.join(temporaryDirectory, "empty");
    await mkdir(empty);
    await expectAsyncError(SpikeGateError, "OUTPUT_SHAPE", () => readSingleSvg(empty));

    const extra = path.join(temporaryDirectory, "extra");
    await mkdir(extra);
    await Promise.all([
      writeFile(path.join(extra, "one.svg"), safeSvg),
      writeFile(path.join(extra, "runtime.js"), "alert(1)"),
    ]);
    await expectAsyncError(SpikeGateError, "OUTPUT_SHAPE", () => readSingleSvg(extra));
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }

  const bytes = Buffer.from(safeSvg, "utf8");
  assertDeterministic({ filename: "same.svg", bytes }, { filename: "same.svg", bytes: Buffer.from(bytes) });
  assertions += 1;
  expectError(SpikeGateError, "NONDETERMINISTIC", () =>
    assertDeterministic(
      { filename: "same.svg", bytes },
      { filename: "same.svg", bytes: Buffer.from(`${safeSvg} `) },
    ),
  );
}

async function testActualLockfile() {
  const gateDirectory = path.dirname(fileURLToPath(import.meta.url));
  const packageDirectory = path.dirname(gateDirectory);
  await assertNoShrinkwrap(packageDirectory);
  const inventory = await auditPackageFiles(
    path.join(packageDirectory, "package-lock.json"),
    path.join(packageDirectory, "package.json"),
  );
  assert.equal(inventory.summary.verdict, "pass");
  assert.equal(inventory.summary.missing, 0);
  assert.equal(inventory.summary.unknown, 0);
  assert.equal(inventory.summary.denied, 0);
  assertions += 4;
}

testLicenseExpressions();
testLockAudit();
testSafeSvg();
testSvgRejections();
await testOutputContract();
await testActualLockfile();

process.stdout.write(`MERMAID_SPIKE_GATE_SELF_TEST_PASS ${assertions} assertions\n`);
