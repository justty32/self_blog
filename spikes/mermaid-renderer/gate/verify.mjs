import { spawnSync } from "node:child_process";
import { readFile, readdir, rm, stat, mkdtemp, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  LicenseGateError,
  assertNoShrinkwrap,
  auditPackageFiles,
} from "./license.mjs";
import { SvgGateError, inspectSvg } from "./svg.mjs";

const RENDER_TIMEOUT_MS = 60_000;

export class SpikeGateError extends Error {
  constructor(code, message, exitCode = 1) {
    super(message);
    this.name = "SpikeGateError";
    this.code = code;
    this.exitCode = exitCode;
  }
}

function fail(code, message, exitCode = 1) {
  throw new SpikeGateError(code, message, exitCode);
}

function parseArguments(argv) {
  const known = new Set(["--renderer", "--cases", "--lockfile"]);
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!known.has(key) || value === undefined || value.startsWith("--")) {
      fail(
        "USAGE",
        "Usage: node gate/verify.mjs --renderer <file> --cases <file> --lockfile <file>",
        2,
      );
    }
    if (values.has(key)) {
      fail("USAGE", `Duplicate argument: ${key}`, 2);
    }
    values.set(key, value);
  }
  if (values.size !== known.size) {
    fail(
      "USAGE",
      "Usage: node gate/verify.mjs --renderer <file> --cases <file> --lockfile <file>",
      2,
    );
  }
  return Object.fromEntries([...values].map(([key, value]) => [key.slice(2), path.resolve(value)]));
}

async function requireRenderer(rendererPath) {
  let metadata;
  try {
    metadata = await stat(rendererPath);
  } catch (error) {
    if (error.code === "ENOENT") {
      fail("RENDERER_MISSING", rendererPath);
    }
    throw error;
  }
  if (!metadata.isFile()) {
    fail("RENDERER_NOT_FILE", rendererPath);
  }
}

function validateCases(value, casesPath) {
  if (!value || typeof value !== "object" || Array.isArray(value) || value.schemaVersion !== 1) {
    fail("INVALID_CASES", `${casesPath} must use schemaVersion 1`, 2);
  }
  if (!Array.isArray(value.valid) || value.valid.length === 0 || !Array.isArray(value.invalid)) {
    fail("INVALID_CASES", `${casesPath} must contain valid and invalid arrays`, 2);
  }

  const ids = new Set();
  for (const item of [...value.valid, ...value.invalid]) {
    if (
      !item ||
      typeof item !== "object" ||
      typeof item.id !== "string" ||
      item.id.length === 0 ||
      typeof item.input !== "string" ||
      item.input.length === 0
    ) {
      fail("INVALID_CASES", `${casesPath} contains an invalid case descriptor`, 2);
    }
    if (ids.has(item.id)) {
      fail("INVALID_CASES", `${casesPath} contains duplicate id ${item.id}`, 2);
    }
    ids.add(item.id);
  }
  for (const item of value.valid) {
    if (
      typeof item.title !== "string" ||
      item.title.length === 0 ||
      typeof item.description !== "string" ||
      item.description.length === 0 ||
      !Array.isArray(item.expectedText) ||
      item.expectedText.some((text) => typeof text !== "string" || text.length === 0)
    ) {
      fail("INVALID_CASES", `${item.id} has invalid expected SVG metadata`, 2);
    }
  }
  return value;
}

function resolveFixture(fixturesDirectory, relativeInput) {
  const absolute = path.resolve(fixturesDirectory, relativeInput);
  const relative = path.relative(fixturesDirectory, absolute);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    fail("FIXTURE_ESCAPE", `Fixture leaves its directory: ${relativeInput}`, 2);
  }
  return absolute;
}

async function assertOnlyOutputDirectory(temporaryDirectory, outputDirectory) {
  const entries = await readdir(temporaryDirectory, { withFileTypes: true });
  if (
    entries.length !== 1 ||
    entries[0].name !== path.basename(outputDirectory) ||
    !entries[0].isDirectory()
  ) {
    fail("OUTPUT_ESCAPE", "Renderer wrote outside the requested output directory");
  }
}

export async function readSingleSvg(outputDirectory) {
  const entries = await readdir(outputDirectory, { withFileTypes: true });
  if (entries.length !== 1 || !entries[0].isFile() || !entries[0].name.endsWith(".svg")) {
    fail("OUTPUT_SHAPE", "Renderer must write exactly one top-level .svg file");
  }
  const filename = entries[0].name;
  return {
    filename,
    bytes: await readFile(path.join(outputDirectory, filename)),
  };
}

export function assertDeterministic(first, second) {
  if (first.filename !== second.filename || !first.bytes.equals(second.bytes)) {
    fail("NONDETERMINISTIC", "Two isolated renders did not produce identical bytes and filenames");
  }
}

function runRenderer(rendererPath, inputPath, outputDirectory, cwd, marker) {
  return spawnSync(
    process.execPath,
    [rendererPath, "--input", inputPath, "--output-dir", outputDirectory],
    {
      cwd,
      env: { ...process.env, MERMAID_SPIKE_UNRELATED_MARKER: marker },
      encoding: "utf8",
      timeout: RENDER_TIMEOUT_MS,
      windowsHide: true,
      maxBuffer: 1024 * 1024,
    },
  );
}

function assertSuccessfulProcess(result, caseId) {
  if (result.error) {
    const code = result.error.code === "ETIMEDOUT" ? "RENDER_TIMEOUT" : "RENDER_PROCESS";
    fail(code, `${caseId}: ${result.error.message}`);
  }
  if (result.signal) {
    fail("RENDER_SIGNAL", `${caseId}: renderer terminated via ${result.signal}`);
  }
  if (result.status !== 0) {
    fail(
      "RENDER_EXIT",
      `${caseId}: renderer exited ${String(result.status)}: ${(result.stderr ?? "").trim()}`,
    );
  }
}

async function renderValid(rendererPath, inputPath, expected, runNumber) {
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "self-blog-mermaid-valid-"));
  const outputDirectory = path.join(temporaryDirectory, "output");
  await mkdir(outputDirectory);
  try {
    const result = runRenderer(
      rendererPath,
      inputPath,
      outputDirectory,
      temporaryDirectory,
      `run-${runNumber}`,
    );
    assertSuccessfulProcess(result, expected.id);
    await assertOnlyOutputDirectory(temporaryDirectory, outputDirectory);
    const output = await readSingleSvg(outputDirectory);
    const inspection = inspectSvg(output.bytes, output.filename, expected);
    return { ...output, inspection };
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

async function renderInvalid(rendererPath, inputPath, caseId) {
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "self-blog-mermaid-invalid-"));
  const outputDirectory = path.join(temporaryDirectory, "output");
  await mkdir(outputDirectory);
  try {
    const result = runRenderer(rendererPath, inputPath, outputDirectory, temporaryDirectory, "invalid");
    if (result.error) {
      fail("INVALID_PROCESS", `${caseId}: ${result.error.message}`);
    }
    if (result.signal || result.status !== 65) {
      fail("INVALID_EXIT", `${caseId}: expected exit 65, found ${String(result.status)}`);
    }
    if (!(result.stderr ?? "").startsWith("MERMAID_INPUT_ERROR")) {
      fail("INVALID_STDERR", `${caseId}: stderr must begin with MERMAID_INPUT_ERROR`);
    }
    await assertOnlyOutputDirectory(temporaryDirectory, outputDirectory);
    const entries = await readdir(outputDirectory);
    if (entries.length !== 0) {
      fail("INVALID_OUTPUT", `${caseId}: rejected input left output files behind`);
    }
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

export async function verifySpike({ renderer, cases: casesPath, lockfile }) {
  await requireRenderer(renderer);
  const packageDirectory = path.dirname(lockfile);
  const packageJsonPath = path.join(packageDirectory, "package.json");
  await assertNoShrinkwrap(packageDirectory);
  const licenseInventory = await auditPackageFiles(lockfile, packageJsonPath);

  let cases;
  try {
    cases = validateCases(JSON.parse(await readFile(casesPath, "utf8")), casesPath);
  } catch (error) {
    if (error instanceof SyntaxError) {
      fail("INVALID_CASES_JSON", `${casesPath}: ${error.message}`, 2);
    }
    throw error;
  }

  const fixturesDirectory = path.dirname(casesPath);
  const rendered = [];
  for (const item of cases.valid) {
    const input = resolveFixture(fixturesDirectory, item.input);
    const first = await renderValid(renderer, input, item, 1);
    const second = await renderValid(renderer, input, item, 2);
    assertDeterministic(first, second);
    rendered.push({ id: item.id, ...first.inspection });
  }
  for (const item of cases.invalid) {
    await renderInvalid(renderer, resolveFixture(fixturesDirectory, item.input), item.id);
  }

  return {
    schemaVersion: 1,
    verdict: "pass",
    renderer,
    license: licenseInventory.summary,
    validCases: rendered,
    invalidCases: cases.invalid.map(({ id }) => id),
  };
}

export async function main(argv = process.argv.slice(2)) {
  try {
    const result = await verifySpike(parseArguments(argv));
    process.stdout.write(`MERMAID_SPIKE_PASS ${JSON.stringify(result)}\n`);
    return 0;
  } catch (error) {
    if (error instanceof SpikeGateError) {
      const prefix = error.exitCode === 2 ? "MERMAID_SPIKE_GATE_ERROR" : "MERMAID_SPIKE_FAIL";
      process.stderr.write(`${prefix} ${error.code} ${error.message}\n`);
      return error.exitCode;
    }
    if (error instanceof LicenseGateError || error instanceof SvgGateError) {
      process.stderr.write(`MERMAID_SPIKE_FAIL ${error.code} ${error.message}\n`);
      return 1;
    }
    process.stderr.write(`MERMAID_SPIKE_GATE_ERROR INTERNAL ${error.stack ?? error.message}\n`);
    return 2;
  }
}

const isMain =
  process.argv[1] !== undefined &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  process.exitCode = await main();
}
