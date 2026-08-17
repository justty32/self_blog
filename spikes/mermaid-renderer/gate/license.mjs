import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import jsep from "jsep";

const require = createRequire(import.meta.url);
const spdxLicenseIds = require("spdx-license-ids");

export const PROFILE_B_ALLOWED = Object.freeze([
  "0BSD",
  "Apache-2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "CC0-1.0",
  "ISC",
  "MIT",
]);

const allowed = new Set(PROFILE_B_ALLOWED);
const canonicalIds = new Map(
  spdxLicenseIds.map((identifier) => [identifier.toLowerCase(), identifier]),
);

export class LicenseGateError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "LicenseGateError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new LicenseGateError(code, message, details);
}

function tokenizeAndEncode(rawExpression) {
  if (typeof rawExpression !== "string") {
    fail("INVALID_LICENSE_TYPE", "License expression must be a string");
  }

  const expression = rawExpression.trim();
  if (expression.length === 0) {
    fail("MISSING_LICENSE", "License expression is empty");
  }

  const identifiers = [];
  const encoded = [];
  let cursor = 0;

  while (cursor < expression.length) {
    const rest = expression.slice(cursor);
    const whitespace = rest.match(/^\s+/u);
    if (whitespace) {
      cursor += whitespace[0].length;
      continue;
    }

    const character = expression[cursor];
    if (character === "(" || character === ")") {
      encoded.push(character);
      cursor += 1;
      continue;
    }

    const operator = rest.match(/^(AND|OR|WITH|and|or|with)(?![A-Za-z0-9])/u);
    if (operator) {
      const normalized = operator[1].toUpperCase();
      if (normalized === "WITH") {
        fail(
          "LICENSE_EXCEPTION_NOT_ALLOWED",
          `SPDX exceptions are outside profile B: ${expression}`,
        );
      }
      encoded.push(normalized === "AND" ? "&&" : "||");
      cursor += operator[0].length;
      continue;
    }

    const identifierMatch = rest.match(/^[A-Za-z0-9][A-Za-z0-9.+-]*/u);
    if (!identifierMatch) {
      fail(
        "INVALID_SPDX",
        `Unexpected token at offset ${cursor}: ${JSON.stringify(expression)}`,
      );
    }

    const rawIdentifier = identifierMatch[0];
    if (/^(?:DocumentRef-|LicenseRef-)/iu.test(rawIdentifier)) {
      fail(
        "UNRESOLVED_LICENSE_REF",
        `LicenseRef/DocumentRef has no extracted text in the lockfile: ${rawIdentifier}`,
      );
    }

    const canonical = canonicalIds.get(rawIdentifier.toLowerCase());
    if (!canonical) {
      fail("UNKNOWN_SPDX_ID", `Unknown SPDX identifier: ${rawIdentifier}`);
    }

    const variable = `license_${identifiers.length}`;
    identifiers.push({ variable, id: canonical });
    encoded.push(variable);
    cursor += rawIdentifier.length;
  }

  return { encoded: encoded.join(" "), identifiers };
}

function evaluateAst(node, values) {
  if (node.type === "Identifier") {
    if (!values.has(node.name)) {
      fail("INVALID_SPDX_AST", `Unexpected identifier in parsed expression: ${node.name}`);
    }
    return values.get(node.name);
  }

  if (node.type === "BinaryExpression") {
    if (node.operator === "&&") {
      return evaluateAst(node.left, values) && evaluateAst(node.right, values);
    }
    if (node.operator === "||") {
      return evaluateAst(node.left, values) || evaluateAst(node.right, values);
    }
  }

  fail("INVALID_SPDX_AST", `Unsupported parsed expression node: ${node.type}`);
}

function formatAst(node, identifiers) {
  if (node.type === "Identifier") {
    const identifier = identifiers.get(node.name);
    if (!identifier) {
      fail("INVALID_SPDX_AST", `Unexpected identifier in parsed expression: ${node.name}`);
    }
    return identifier;
  }

  if (node.type === "BinaryExpression" && ["&&", "||"].includes(node.operator)) {
    const operator = node.operator === "&&" ? "AND" : "OR";
    return `(${formatAst(node.left, identifiers)} ${operator} ${formatAst(node.right, identifiers)})`;
  }

  fail("INVALID_SPDX_AST", `Unsupported parsed expression node: ${node.type}`);
}

export function evaluateProfileB(rawExpression) {
  const { encoded, identifiers } = tokenizeAndEncode(rawExpression);
  let ast;
  try {
    ast = jsep(encoded);
  } catch (error) {
    fail("INVALID_SPDX", `Cannot parse ${JSON.stringify(rawExpression)}: ${error.message}`);
  }

  const values = new Map(
    identifiers.map(({ variable, id }) => [variable, allowed.has(id)]),
  );
  const verdict = evaluateAst(ast, values);
  if (!verdict) {
    fail(
      "NOT_ALLOWLISTED",
      `Expression is not allowed by profile B: ${rawExpression}`,
      { identifiers: identifiers.map(({ id }) => id) },
    );
  }

  const witness = identifiers.find(({ id }) => allowed.has(id))?.id ?? null;
  const canonicalIdentifiers = new Map(
    identifiers.map(({ variable, id }) => [variable, id]),
  );
  return {
    raw: rawExpression,
    normalized: formatAst(ast, canonicalIdentifiers),
    witness,
  };
}

function hashText(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function dependencyMaps(root) {
  return [
    "dependencies",
    "devDependencies",
    "optionalDependencies",
    "peerDependencies",
  ].map((key) => [key, root[key] ?? {}]);
}

function assertRootConsistency(packageJson, lockRoot) {
  for (const [key, expected] of dependencyMaps(packageJson)) {
    const actual = lockRoot[key] ?? {};
    const normalize = (value) => Object.fromEntries(Object.entries(value).sort());
    if (JSON.stringify(normalize(expected)) !== JSON.stringify(normalize(actual))) {
      fail(
        "STALE_LOCKFILE",
        `package.json ${key} does not match package-lock packages[\"\"].${key}`,
      );
    }
  }
}

export function auditPackageLock(lockfile, packageJson, rawLockfile = "") {
  if (!lockfile || typeof lockfile !== "object" || Array.isArray(lockfile)) {
    fail("INVALID_LOCKFILE", "package-lock.json must contain an object");
  }
  if (!packageJson || typeof packageJson !== "object" || Array.isArray(packageJson)) {
    fail("INVALID_PACKAGE_JSON", "package.json must contain an object");
  }
  if (lockfile.lockfileVersion !== 3) {
    fail(
      "LOCKFILE_VERSION",
      `Expected lockfileVersion 3, found ${String(lockfile.lockfileVersion)}`,
    );
  }
  if (!lockfile.packages || typeof lockfile.packages !== "object") {
    fail("LOCKFILE_PACKAGES", "package-lock.json has no packages map");
  }

  const lockRoot = lockfile.packages[""];
  if (!lockRoot || typeof lockRoot !== "object") {
    fail("LOCKFILE_ROOT", "package-lock.json has no root package descriptor");
  }
  if (packageJson.license !== "MIT" || lockRoot.license !== "MIT") {
    fail("ROOT_NOT_MIT", "The spike package and lockfile root must both declare MIT");
  }
  assertRootConsistency(packageJson, lockRoot);

  const directNames = new Set(
    dependencyMaps(packageJson).flatMap(([, dependencies]) => Object.keys(dependencies)),
  );
  const inventory = [];

  for (const locator of Object.keys(lockfile.packages).sort()) {
    const descriptor = lockfile.packages[locator];
    if (!descriptor || typeof descriptor !== "object") {
      fail("INVALID_PACKAGE_DESCRIPTOR", `Invalid descriptor at ${locator || "<root>"}`);
    }
    if (descriptor.link === true) {
      fail("UNSUPPORTED_LOCAL_SOURCE", `Linked package is not allowed in the spike: ${locator}`);
    }
    if (typeof descriptor.license !== "string" || descriptor.license.trim() === "") {
      fail("MISSING_LICENSE", `${locator || "<root>"} has no license expression`);
    }

    let license;
    try {
      license = evaluateProfileB(descriptor.license.trim());
    } catch (error) {
      if (error instanceof LicenseGateError) {
        error.message = `${locator || "<root>"}: ${error.message}`;
        error.details = { ...error.details, locator };
      }
      throw error;
    }

    const installName = locator
      ? locator.slice(locator.lastIndexOf("node_modules/") + "node_modules/".length)
      : packageJson.name;
    inventory.push({
      locator: locator || "<root>",
      installName,
      version: descriptor.version ?? packageJson.version,
      relationship:
        locator === ""
          ? "root"
          : directNames.has(installName) && locator === `node_modules/${installName}`
            ? "direct"
            : "transitive",
      usage: descriptor.dev === true ? "dev-only" : "production-reachable",
      flags: {
        optional: descriptor.optional === true,
        devOptional: descriptor.devOptional === true,
        peer: descriptor.peer === true,
        inBundle: descriptor.inBundle === true,
      },
      license,
    });
  }

  return {
    schemaVersion: 1,
    profile: "B-permissive",
    input: {
      lockfileVersion: lockfile.lockfileVersion,
      lockfileSha256: hashText(rawLockfile),
    },
    summary: {
      verdict: "pass",
      instances: inventory.length,
      direct: inventory.filter(({ relationship }) => relationship === "direct").length,
      transitive: inventory.filter(({ relationship }) => relationship === "transitive").length,
      devOnly: inventory.filter(({ usage }) => usage === "dev-only").length,
      missing: 0,
      unknown: 0,
      denied: 0,
    },
    packages: inventory,
  };
}

export async function auditPackageFiles(lockfilePath, packageJsonPath) {
  const [rawLockfile, rawPackageJson] = await Promise.all([
    readFile(lockfilePath, "utf8"),
    readFile(packageJsonPath, "utf8"),
  ]);
  return auditPackageLock(
    JSON.parse(rawLockfile),
    JSON.parse(rawPackageJson),
    rawLockfile,
  );
}

export async function assertNoShrinkwrap(packageDirectory) {
  try {
    await readFile(path.join(packageDirectory, "npm-shrinkwrap.json"));
  } catch (error) {
    if (error.code === "ENOENT") {
      return;
    }
    throw error;
  }
  fail("SHRINKWRAP_FORBIDDEN", "npm-shrinkwrap.json must not coexist with package-lock.json");
}
