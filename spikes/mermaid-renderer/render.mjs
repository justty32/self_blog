import { createHash } from "node:crypto";
import { lstat, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import puppeteer from "puppeteer-core";

const MAX_SOURCE_BYTES = 64 * 1024;
export const RENDERER_PROFILE = "self-blog-mermaid-v1";
const MERMAID_BUNDLE_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.resolve("mermaid"))),
  "mermaid.min.js",
);

export class MermaidInputError extends Error {
  constructor(message) {
    super(message);
    this.name = "MermaidInputError";
  }
}

export class RendererError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "RendererError";
    this.code = code;
  }
}

function rendererFail(code, message) {
  throw new RendererError(code, message);
}

function parseArguments(argv) {
  if (argv.length !== 4) {
    rendererFail(
      "USAGE",
      "Usage: node render.mjs --input <absolute .mmd> --output-dir <empty absolute directory>",
    );
  }
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!["--input", "--output-dir"].includes(key) || !value || values.has(key)) {
      rendererFail("USAGE", `Invalid renderer argument: ${String(key)}`);
    }
    if (!path.isAbsolute(value)) {
      rendererFail("USAGE", `${key} must be an absolute path`);
    }
    values.set(key, path.normalize(value));
  }
  if (!values.has("--input") || !values.has("--output-dir")) {
    rendererFail("USAGE", "Both --input and --output-dir are required");
  }
  return { input: values.get("--input"), outputDirectory: values.get("--output-dir") };
}

async function isFile(filename) {
  try {
    return (await stat(filename)).isFile();
  } catch (error) {
    if (error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

function browserCandidates() {
  const candidates = [];
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    candidates.push(process.env.PUPPETEER_EXECUTABLE_PATH);
  }
  if (process.platform === "win32") {
    for (const base of [
      process.env.ProgramFiles,
      process.env["ProgramFiles(x86)"],
      process.env.LOCALAPPDATA,
    ]) {
      if (!base) {
        continue;
      }
      candidates.push(
        path.join(base, "Google", "Chrome", "Application", "chrome.exe"),
        path.join(base, "Microsoft", "Edge", "Application", "msedge.exe"),
      );
    }
  } else if (process.platform === "darwin") {
    candidates.push(
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
    );
  } else {
    candidates.push(
      "/usr/bin/google-chrome",
      "/usr/bin/google-chrome-stable",
      "/usr/bin/chromium",
      "/usr/bin/chromium-browser",
    );
  }
  return [...new Set(candidates.map((candidate) => path.resolve(candidate)))];
}

export async function resolveBrowserExecutable() {
  const configured = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (configured && !(await isFile(path.resolve(configured)))) {
    rendererFail(
      "BROWSER_NOT_FOUND",
      `PUPPETEER_EXECUTABLE_PATH does not name a file: ${configured}`,
    );
  }
  for (const candidate of browserCandidates()) {
    if (await isFile(candidate)) {
      return candidate;
    }
  }
  rendererFail(
    "BROWSER_NOT_FOUND",
    "No existing Chrome, Edge, or Chromium executable was found; set PUPPETEER_EXECUTABLE_PATH",
  );
}

async function validatePaths(input, outputDirectory) {
  if (path.extname(input).toLowerCase() !== ".mmd") {
    rendererFail("INPUT_EXTENSION", "Renderer input must use the .mmd extension");
  }
  const inputMetadata = await lstat(input).catch((error) => {
    if (error.code === "ENOENT") {
      rendererFail("INPUT_MISSING", input);
    }
    throw error;
  });
  if (!inputMetadata.isFile() || inputMetadata.isSymbolicLink()) {
    rendererFail("INPUT_NOT_FILE", "Renderer input must be a regular file");
  }
  const outputMetadata = await lstat(outputDirectory).catch((error) => {
    if (error.code === "ENOENT") {
      rendererFail("OUTPUT_MISSING", outputDirectory);
    }
    throw error;
  });
  if (!outputMetadata.isDirectory() || outputMetadata.isSymbolicLink()) {
    rendererFail("OUTPUT_NOT_DIRECTORY", "Output must be a regular directory");
  }
  if ((await readdir(outputDirectory)).length !== 0) {
    rendererFail("OUTPUT_NOT_EMPTY", "Output directory must be empty");
  }
}

async function readSource(input) {
  const bytes = await readFile(input);
  if (bytes.byteLength > MAX_SOURCE_BYTES) {
    throw new MermaidInputError(
      `source is ${bytes.byteLength} bytes; the limit is ${MAX_SOURCE_BYTES}`,
    );
  }
  let source;
  try {
    source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (error) {
    throw new MermaidInputError(`source is not valid UTF-8: ${error.message}`);
  }
  if (source.startsWith("\uFEFF")) {
    throw new MermaidInputError("source must not begin with a byte-order mark");
  }
  if (source.trim().length === 0) {
    throw new MermaidInputError("source is empty");
  }
  return source;
}

function browserSanitizer(source) {
  const interactiveSelector = /:(?:active|focus|focus-visible|focus-within|hover|link|target|visited)\b/iu;
  const localUrl = /^#[A-Za-z_][A-Za-z0-9_.:-]*$/u;

  function verifyCssUrls(value, where) {
    for (const match of value.matchAll(/url\(([^)]*)\)/giu)) {
      const candidate = match[1].trim().replace(/^(["'])(.*)\1$/su, "$2");
      if (!localUrl.test(candidate)) {
        throw new Error(`${where} contains an external CSS URL`);
      }
    }
  }

  function sanitizeStyleSheet(styleElement) {
    const sheet = styleElement.sheet;
    if (!sheet) {
      throw new Error("generated SVG style sheet could not be parsed");
    }
    const safeRules = [];
    for (const rule of Array.from(sheet.cssRules)) {
      if (rule.type !== CSSRule.STYLE_RULE) {
        continue;
      }
      if (interactiveSelector.test(rule.selectorText)) {
        continue;
      }
      for (const property of Array.from(rule.style)) {
        const normalized = property.toLowerCase();
        if (normalized.startsWith("animation") || normalized.startsWith("transition")) {
          rule.style.removeProperty(property);
          continue;
        }
        verifyCssUrls(rule.style.getPropertyValue(property), `CSS property ${property}`);
      }
      safeRules.push(rule.cssText);
    }
    styleElement.textContent = safeRules.join("");
  }

  function unwrap(element) {
    const parent = element.parentNode;
    if (!parent) {
      return;
    }
    while (element.firstChild) {
      parent.insertBefore(element.firstChild, element);
    }
    element.remove();
  }

  function canonicalNumber(value) {
    return Number(Number(value).toFixed(6)).toString();
  }

  function measureFonts() {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("browser does not provide a 2D canvas context for font metrics");
    }
    context.font = "16px Arial, sans-serif";
    return ["ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", "草稿檢查建置部署聯絡方式"].map(
      (sample) => {
        const metrics = context.measureText(sample);
        return {
          sample,
          width: canonicalNumber(metrics.width),
          ascent: canonicalNumber(metrics.actualBoundingBoxAscent),
          descent: canonicalNumber(metrics.actualBoundingBoxDescent),
        };
      },
    );
  }

  return globalThis.mermaid
    .render("self-blog-diagram", source, document.querySelector("#render-root"))
    .then(({ svg }) => {
      const host = document.querySelector("#result-root");
      host.innerHTML = svg;
      const root = host.querySelector(":scope > svg");
      if (!root || host.children.length !== 1) {
        throw new Error("Mermaid did not return exactly one SVG root");
      }

      for (const element of Array.from(
        root.querySelectorAll(
          "script,foreignObject,iframe,object,embed,image,feImage,audio,video,animate,animateMotion,animateTransform,set,discard",
        ),
      )) {
        throw new Error(`generated SVG contains forbidden <${element.localName}>`);
      }
      for (const anchor of Array.from(root.querySelectorAll("a"))) {
        unwrap(anchor);
      }
      for (const styleElement of Array.from(root.querySelectorAll("style"))) {
        sanitizeStyleSheet(styleElement);
      }

      for (const element of [root, ...root.querySelectorAll("*")]) {
        for (const attribute of Array.from(element.attributes)) {
          const local = attribute.localName.toLowerCase();
          if (local.startsWith("on") || (attribute.prefix === "xml" && local === "base")) {
            element.removeAttributeNode(attribute);
            continue;
          }
          if (["href", "src"].includes(local)) {
            const normalized = attribute.value.replace(/[\u0000-\u0020\u007F]/gu, "");
            if (!localUrl.test(normalized)) {
              element.removeAttributeNode(attribute);
            }
          }
        }
        if (element.hasAttribute("style")) {
          for (const property of Array.from(element.style)) {
            const normalized = property.toLowerCase();
            if (normalized.startsWith("animation") || normalized.startsWith("transition")) {
              element.style.removeProperty(property);
              continue;
            }
            verifyCssUrls(element.style.getPropertyValue(property), `style property ${property}`);
          }
        }
      }

      const titles = Array.from(root.children).filter(
        (element) => element.localName.toLowerCase() === "title",
      );
      const descriptions = Array.from(root.children).filter(
        (element) => element.localName.toLowerCase() === "desc",
      );
      if (titles.length !== 1 || titles[0].textContent.trim().length === 0) {
        throw new Error("source must provide exactly one non-empty accTitle");
      }
      if (descriptions.length !== 1 || descriptions[0].textContent.trim().length === 0) {
        throw new Error("source must provide exactly one non-empty accDescr");
      }
      titles[0].id = "mermaid-title";
      descriptions[0].id = "mermaid-description";
      root.setAttribute("role", "img");
      root.setAttribute("aria-labelledby", "mermaid-title mermaid-description");
      root.removeAttribute("aria-describedby");
      root.removeAttribute("aria-roledescription");

      const viewBox = (root.getAttribute("viewBox") ?? "")
        .trim()
        .split(/[\s,]+/u)
        .map(Number);
      if (
        viewBox.length !== 4 ||
        viewBox.some((value) => !Number.isFinite(value)) ||
        viewBox[2] <= 0 ||
        viewBox[3] <= 0
      ) {
        throw new Error("generated SVG has an invalid viewBox");
      }
      root.setAttribute("viewBox", viewBox.map(canonicalNumber).join(" "));
      root.setAttribute("width", canonicalNumber(viewBox[2]));
      root.setAttribute("height", canonicalNumber(viewBox[3]));

      return {
        svg: `${new XMLSerializer().serializeToString(root)}\n`,
        fontMetrics: measureFonts(),
      };
    });
}

export async function renderMermaid(source, executablePath) {
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: [
      "--disable-background-networking",
      "--disable-component-update",
      "--disable-default-apps",
      "--disable-dev-shm-usage",
      "--disable-extensions",
      "--disable-gpu",
      "--disable-sync",
      "--metrics-recording-only",
      "--no-default-browser-check",
      "--no-first-run",
    ],
  });
  try {
    const page = await browser.newPage();
    const blockedRequests = [];
    await page.setOfflineMode(true);
    await page.setRequestInterception(true);
    page.on("request", (request) => {
      blockedRequests.push(request.url());
      void request.abort("blockedbyclient");
    });
    await page.setContent(
      '<!doctype html><html><head><meta charset="utf-8"></head><body><div id="render-root"></div><div id="result-root"></div></body></html>',
    );
    await page.addScriptTag({ path: MERMAID_BUNDLE_PATH });
    await page.evaluate(() => {
      globalThis.mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        suppressErrorRendering: true,
        deterministicIds: true,
        deterministicIDSeed: "self-blog-mermaid-v1",
        fontFamily: "Arial, sans-serif",
        htmlLabels: false,
        maxTextSize: 50_000,
        theme: "base",
        flowchart: {
          htmlLabels: false,
          useMaxWidth: false,
        },
      });
    });

    let rendered;
    try {
      rendered = await page.evaluate(browserSanitizer, source);
    } catch (error) {
      throw new MermaidInputError(error.message);
    }
    if (blockedRequests.length > 0) {
      throw new MermaidInputError(
        `render attempted ${blockedRequests.length} blocked network request(s)`,
      );
    }
    const browserVersion = await browser.version();
    const environmentFingerprint = createHash("sha256")
      .update(JSON.stringify({ browserVersion, fontMetrics: rendered.fontMetrics }), "utf8")
      .digest("hex");
    return {
      ...rendered,
      browser: browserVersion,
      executablePath,
      environmentFingerprint,
    };
  } finally {
    await browser.close();
  }
}

export async function run({ input, outputDirectory }) {
  await validatePaths(input, outputDirectory);
  if (!(await isFile(MERMAID_BUNDLE_PATH))) {
    rendererFail("MERMAID_BUNDLE_MISSING", MERMAID_BUNDLE_PATH);
  }
  const source = await readSource(input);
  const executablePath = await resolveBrowserExecutable();
  const result = await renderMermaid(source, executablePath);
  const bytes = Buffer.from(result.svg, "utf8");
  const digest = createHash("sha256").update(bytes).digest("hex");
  const filename = `${digest}.svg`;
  await writeFile(path.join(outputDirectory, filename), bytes, { flag: "wx" });
  return {
    ...result,
    rendererProfile: RENDERER_PROFILE,
    bytes: bytes.byteLength,
    sha256: digest,
    filename,
  };
}

export async function main(argv = process.argv.slice(2)) {
  try {
    await run(parseArguments(argv));
    return 0;
  } catch (error) {
    if (error instanceof MermaidInputError) {
      process.stderr.write(`MERMAID_INPUT_ERROR ${error.message}\n`);
      return 65;
    }
    if (error instanceof RendererError) {
      process.stderr.write(`MERMAID_RENDERER_ERROR ${error.code} ${error.message}\n`);
      return error.code === "USAGE" ? 64 : 1;
    }
    process.stderr.write(`MERMAID_RENDERER_ERROR INTERNAL ${error.stack ?? error.message}\n`);
    return 1;
  }
}

const isMain =
  process.argv[1] !== undefined &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  process.exitCode = await main();
}
