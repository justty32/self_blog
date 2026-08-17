import { createHash } from "node:crypto";
import path from "node:path";
import { generate, parse, walk } from "css-tree";
import { SaxesParser } from "saxes";

export const MAX_SVG_BYTES = 100 * 1024;

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const XMLNS_NAMESPACE = "http://www.w3.org/2000/xmlns/";
const XML_NAMESPACE = "http://www.w3.org/XML/1998/namespace";
const XLINK_NAMESPACE = "http://www.w3.org/1999/xlink";
const MAX_ELEMENTS = 10_000;
const MAX_DEPTH = 128;

const forbiddenElements = new Set([
  "a",
  "audio",
  "discard",
  "embed",
  "feimage",
  "foreignobject",
  "iframe",
  "image",
  "object",
  "script",
  "set",
  "video",
]);

const uriAttributes = new Set(["href", "src"]);
const cssValueAttributes = new Set([
  "clip-path",
  "cursor",
  "fill",
  "filter",
  "marker-end",
  "marker-mid",
  "marker-start",
  "mask",
  "stroke",
]);

export class SvgGateError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "SvgGateError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new SvgGateError(code, message, details);
}

function decodeUtf8(bytes) {
  if (!Buffer.isBuffer(bytes) && !(bytes instanceof Uint8Array)) {
    fail("INVALID_BUFFER", "SVG input must be bytes");
  }
  if (bytes.byteLength > MAX_SVG_BYTES) {
    fail(
      "SVG_TOO_LARGE",
      `SVG is ${bytes.byteLength} bytes; the limit is ${MAX_SVG_BYTES}`,
    );
  }

  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (error) {
    fail("INVALID_UTF8", `SVG is not valid UTF-8: ${error.message}`);
  }
  if (text.startsWith("\uFEFF")) {
    fail("BOM_FORBIDDEN", "SVG must not begin with a byte-order mark");
  }
  if (text.includes("\r")) {
    fail("CR_FORBIDDEN", "SVG must use LF line endings");
  }
  return text;
}

function finitePositiveNumber(raw, field) {
  if (typeof raw !== "string" || !/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/u.test(raw)) {
    fail("INVALID_DIMENSION", `${field} must be a unitless finite number`);
  }
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    fail("INVALID_DIMENSION", `${field} must be greater than zero`);
  }
  return value;
}

function normalizeReference(value) {
  return value.replace(/[\u0000-\u0020\u007F]/gu, "");
}

function requireLocalReference(value, where, references) {
  const normalized = normalizeReference(value);
  if (!/^#[A-Za-z_][A-Za-z0-9_.:-]*$/u.test(normalized)) {
    fail("EXTERNAL_REFERENCE", `${where} must contain only a local #fragment reference`);
  }
  references.push({ id: normalized.slice(1), where });
}

function parseCss(source, context, where, references) {
  if (source.includes("\\")) {
    fail("CSS_ESCAPED_URL", `${where} contains a CSS escape; escaped URLs are not allowed`);
  }
  let ast;
  try {
    ast = parse(source, {
      context,
      parseCustomProperty: true,
      positions: false,
      onParseError(error) {
        throw error;
      },
    });
  } catch (error) {
    fail("INVALID_CSS", `${where} is not valid CSS: ${error.message}`);
  }

  walk(ast, (node) => {
    if (node.type === "Raw") {
      fail("UNPARSED_CSS", `${where} contains CSS that could not be parsed safely`);
    }
    if (node.type === "Atrule") {
      fail("CSS_AT_RULE", `${where} contains forbidden @${node.name}`);
    }
    if (node.type === "Declaration") {
      const property = node.property.toLowerCase();
      if (property.startsWith("animation") || property.startsWith("transition")) {
        fail("CSS_MOTION", `${where} contains forbidden ${node.property}`);
      }
    }
    if (
      node.type === "PseudoClassSelector" &&
      ["active", "focus", "focus-visible", "focus-within", "hover", "link", "target", "visited"].includes(
        node.name.toLowerCase(),
      )
    ) {
      fail("CSS_INTERACTION", `${where} contains interactive :${node.name}`);
    }
    if (node.type === "Function" && node.name.toLowerCase() === "expression") {
      fail("CSS_EXPRESSION", `${where} contains a forbidden expression()`);
    }
    if (node.type !== "Url") {
      return;
    }

    const generated = generate(node);
    if (generated.includes("\\")) {
      fail("CSS_ESCAPED_URL", `${where} contains an escaped CSS URL`);
    }
    const match = /^url\((.*)\)$/isu.exec(generated);
    if (!match) {
      fail("INVALID_CSS_URL", `${where} contains an unreadable CSS URL`);
    }
    let value = match[1].trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    requireLocalReference(value, `${where} URL`, references);
  });
}

function attributeMap(tag) {
  const attributes = new Map();
  for (const attribute of Object.values(tag.attributes)) {
    if (attribute.uri === XMLNS_NAMESPACE) {
      continue;
    }
    if (attribute.uri === XML_NAMESPACE) {
      if (attribute.local.toLowerCase() === "base") {
        fail("XML_BASE", "xml:base is forbidden because it can externalize local references");
      }
      if (["lang", "space"].includes(attribute.local.toLowerCase())) {
        continue;
      }
      fail("FOREIGN_ATTRIBUTE_NAMESPACE", `Unsupported XML attribute ${attribute.name}`);
    }
    if (attribute.uri === XLINK_NAMESPACE && attribute.local.toLowerCase() === "href") {
      continue;
    }
    if (attribute.uri !== "") {
      fail("FOREIGN_ATTRIBUTE_NAMESPACE", `Attribute ${attribute.name} uses a foreign namespace`);
    }
    attributes.set(attribute.local.toLowerCase(), attribute.value);
  }
  return attributes;
}

function parseViewBox(raw) {
  if (typeof raw !== "string") {
    fail("INVALID_VIEWBOX", "viewBox is required");
  }
  const parts = raw.trim().split(/[\s,]+/u);
  if (parts.length !== 4 || parts.some((part) => part.length === 0)) {
    fail("INVALID_VIEWBOX", "viewBox must contain exactly four numbers");
  }
  const values = parts.map(Number);
  if (values.some((value) => !Number.isFinite(value)) || values[2] <= 0 || values[3] <= 0) {
    fail("INVALID_VIEWBOX", "viewBox width and height must be finite and positive");
  }
  return values;
}

function validateExpected(expected) {
  if (!expected || typeof expected !== "object") {
    fail("INVALID_EXPECTATION", "Expected SVG metadata is required");
  }
  if (typeof expected.title !== "string" || expected.title.length === 0) {
    fail("INVALID_EXPECTATION", "Expected title is required");
  }
  if (typeof expected.description !== "string" || expected.description.length === 0) {
    fail("INVALID_EXPECTATION", "Expected description is required");
  }
  if (
    !Array.isArray(expected.expectedText) ||
    expected.expectedText.some((item) => typeof item !== "string" || item.length === 0)
  ) {
    fail("INVALID_EXPECTATION", "expectedText must be an array of non-empty strings");
  }
}

export function inspectSvg(bytes, filename, expected) {
  validateExpected(expected);
  const text = decodeUtf8(bytes);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const expectedFilename = `${sha256}.svg`;
  if (path.basename(filename) !== expectedFilename) {
    fail(
      "HASH_FILENAME",
      `Expected content-addressed filename ${expectedFilename}, found ${path.basename(filename)}`,
    );
  }

  const ids = new Set();
  const references = [];
  const stack = [];
  const directTitles = [];
  const directDescriptions = [];
  const allText = [];
  let root = null;
  let elementCount = 0;

  const parser = new SaxesParser({ xmlns: true, fileName: filename });
  const forbiddenConstruct = (code, label) => () => {
    fail(code, `${label} is forbidden in generated SVG`);
  };
  parser.on("doctype", forbiddenConstruct("DOCTYPE_FORBIDDEN", "DOCTYPE"));
  parser.on("processinginstruction", forbiddenConstruct("PI_FORBIDDEN", "Processing instruction"));
  parser.on("xmldecl", forbiddenConstruct("XML_DECLARATION_FORBIDDEN", "XML declaration"));
  parser.on("cdata", forbiddenConstruct("CDATA_FORBIDDEN", "CDATA"));
  parser.on("comment", forbiddenConstruct("COMMENT_FORBIDDEN", "XML comment"));

  parser.on("opentag", (tag) => {
    elementCount += 1;
    if (elementCount > MAX_ELEMENTS) {
      fail("TOO_MANY_ELEMENTS", `SVG exceeds ${MAX_ELEMENTS} elements`);
    }
    if (stack.length >= MAX_DEPTH) {
      fail("SVG_TOO_DEEP", `SVG exceeds ${MAX_DEPTH} nested elements`);
    }

    const local = tag.local.toLowerCase();
    if (tag.uri !== SVG_NAMESPACE) {
      fail("FOREIGN_NAMESPACE", `Element ${tag.name} is outside the SVG namespace`);
    }
    if (forbiddenElements.has(local) || local.startsWith("animate")) {
      fail("FORBIDDEN_ELEMENT", `Element ${tag.name} is forbidden`);
    }

    const attributes = attributeMap(tag);
    for (const attribute of Object.values(tag.attributes)) {
      if (attribute.uri === XMLNS_NAMESPACE) {
        continue;
      }
      const attributeLocal = attribute.local.toLowerCase();
      if (attributeLocal.startsWith("on")) {
        fail("EVENT_ATTRIBUTE", `Event attribute ${attribute.name} is forbidden`);
      }
      if (uriAttributes.has(attributeLocal)) {
        requireLocalReference(attribute.value, `Attribute ${attribute.name}`, references);
      }
      if (attributeLocal === "style") {
        parseCss(attribute.value, "declarationList", `style attribute on ${tag.name}`, references);
      } else if (cssValueAttributes.has(attributeLocal)) {
        parseCss(attribute.value, "value", `Attribute ${attribute.name}`, references);
      }
    }

    const id = attributes.get("id");
    if (id !== undefined) {
      if (!/^[A-Za-z_][A-Za-z0-9_.:-]*$/u.test(id)) {
        fail("INVALID_ID", `Invalid SVG id: ${JSON.stringify(id)}`);
      }
      if (ids.has(id)) {
        fail("DUPLICATE_ID", `Duplicate SVG id: ${id}`);
      }
      ids.add(id);
    }

    const entry = {
      local,
      attributes,
      directChild: stack.length === 1,
      text: "",
    };
    if (stack.length === 0) {
      if (root !== null || local !== "svg") {
        fail("INVALID_ROOT", "SVG must have exactly one <svg> root");
      }
      root = entry;
    }
    stack.push(entry);
  });

  parser.on("text", (value) => {
    allText.push(value);
    for (const entry of stack) {
      if (entry.local === "title" || entry.local === "desc" || entry.local === "style") {
        entry.text += value;
      }
    }
  });

  parser.on("closetag", () => {
    const entry = stack.pop();
    if (!entry) {
      fail("MALFORMED_XML", "Unexpected closing element");
    }
    if (entry.local === "style") {
      parseCss(entry.text, "stylesheet", "<style>", references);
    }
    if (entry.directChild && entry.local === "title") {
      directTitles.push(entry);
    }
    if (entry.directChild && entry.local === "desc") {
      directDescriptions.push(entry);
    }
  });

  try {
    parser.write(text).close();
  } catch (error) {
    if (error instanceof SvgGateError) {
      throw error;
    }
    fail("MALFORMED_XML", `SVG is not well-formed XML: ${error.message}`);
  }

  if (!root || stack.length !== 0) {
    fail("INVALID_ROOT", "SVG must have exactly one complete <svg> root");
  }
  if (directTitles.length !== 1) {
    fail("TITLE_COUNT", "SVG root must have exactly one direct-child <title>");
  }
  if (directDescriptions.length !== 1) {
    fail("DESCRIPTION_COUNT", "SVG root must have exactly one direct-child <desc>");
  }

  const title = directTitles[0].text.trim();
  const description = directDescriptions[0].text.trim();
  const titleId = directTitles[0].attributes.get("id");
  const descriptionId = directDescriptions[0].attributes.get("id");
  if (!titleId || !descriptionId) {
    fail("A11Y_ID", "Direct title and description must each have a non-empty id");
  }
  if (title !== expected.title) {
    fail("TITLE_MISMATCH", `Expected title ${JSON.stringify(expected.title)}, found ${JSON.stringify(title)}`);
  }
  if (description !== expected.description) {
    fail(
      "DESCRIPTION_MISMATCH",
      `Expected description ${JSON.stringify(expected.description)}, found ${JSON.stringify(description)}`,
    );
  }
  if (root.attributes.get("role") !== "img") {
    fail("A11Y_ROLE", 'SVG root must declare role="img"');
  }
  const labelledBy = root.attributes.get("aria-labelledby")?.trim().split(/\s+/u) ?? [];
  if (labelledBy.length !== 2 || labelledBy[0] !== titleId || labelledBy[1] !== descriptionId) {
    fail("A11Y_REFERENCE", "aria-labelledby must reference title then description exactly");
  }

  const width = finitePositiveNumber(root.attributes.get("width"), "width");
  const height = finitePositiveNumber(root.attributes.get("height"), "height");
  const viewBox = parseViewBox(root.attributes.get("viewbox"));
  const outputRatio = width / height;
  const viewBoxRatio = viewBox[2] / viewBox[3];
  const relativeDifference = Math.abs(outputRatio - viewBoxRatio) / Math.max(outputRatio, viewBoxRatio);
  if (relativeDifference > 1e-3) {
    fail("ASPECT_RATIO", "width/height must match the viewBox aspect ratio");
  }

  for (const { id, where } of references) {
    if (!ids.has(id)) {
      fail("MISSING_FRAGMENT", `${where} references missing id #${id}`);
    }
  }
  const plainText = allText.join(" ");
  for (const expectedValue of expected.expectedText) {
    if (!plainText.includes(expectedValue)) {
      fail("EXPECTED_TEXT", `SVG does not contain expected text ${JSON.stringify(expectedValue)}`);
    }
  }

  return {
    bytes: bytes.byteLength,
    sha256,
    filename: expectedFilename,
    width,
    height,
    viewBox,
    title,
    description,
    elements: elementCount,
  };
}
