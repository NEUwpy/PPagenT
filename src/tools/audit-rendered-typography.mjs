import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

async function layoutFiles(qaDir) {
  const files = (await fs.readdir(qaDir))
    .filter((name) => /^slide-\d+\.layout\.json$/.test(name))
    .sort();
  if (!files.length) throw new Error(`没有找到页面布局证据：${qaDir}`);
  return files;
}

function parseQaName(name) {
  if (typeof name !== "string" || !name.startsWith("PPAGENT_QA|")) return null;
  const result = { domains: [] };
  for (const field of name.slice("PPAGENT_QA|".length).split("|")) {
    const index = field.indexOf("=");
    if (index < 1) continue;
    const key = field.slice(0, index);
    const value = field.slice(index + 1);
    result[key] = key === "domains" ? value.split(",").filter(Boolean) : value;
  }
  return result;
}

function parseConnectorName(name) {
  if (typeof name !== "string" || !name.startsWith("PPAGENT_CONNECTOR|")) return null;
  const result = {};
  for (const field of name.slice("PPAGENT_CONNECTOR|".length).split("|")) {
    const index = field.indexOf("=");
    if (index < 1) continue;
    result[field.slice(0, index)] = field.slice(index + 1);
  }
  return result;
}

function box(element) {
  const [left, top, width, height] = element.bbox ?? [];
  if (![left, top, width, height].every(Number.isFinite)) return null;
  return { left, top, width, height, right: left + width, bottom: top + height };
}

function overlapArea(first, second, tolerance) {
  const width = Math.min(first.right, second.right) - Math.max(first.left, second.left);
  const height = Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top);
  return width > tolerance && height > tolerance ? width * height : 0;
}

function contains(parent, child, tolerance) {
  return child.left >= parent.left - tolerance
    && child.top >= parent.top - tolerance
    && child.right <= parent.right + tolerance
    && child.bottom <= parent.bottom + tolerance;
}

function anchor(boxValue, side) {
  if (side === "top") return { x: boxValue.left + boxValue.width / 2, y: boxValue.top };
  if (side === "right") return { x: boxValue.right, y: boxValue.top + boxValue.height / 2 };
  if (side === "bottom") return { x: boxValue.left + boxValue.width / 2, y: boxValue.bottom };
  if (side === "left") return { x: boxValue.left, y: boxValue.top + boxValue.height / 2 };
  if (side === "center") return { x: boxValue.left + boxValue.width / 2, y: boxValue.top + boxValue.height / 2 };
  return null;
}

function lineEndpoints(element, bbox) {
  return {
    from: {
      x: element.horizontalFlip ? bbox.right : bbox.left,
      y: element.verticalFlip ? bbox.bottom : bbox.top,
    },
    to: {
      x: element.horizontalFlip ? bbox.left : bbox.right,
      y: element.verticalFlip ? bbox.top : bbox.bottom,
    },
  };
}

function pointDistance(first, second) {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

export async function auditRenderedTypography(qaDir, { minimumFontSize = 16 } = {}) {
  const files = await layoutFiles(qaDir);

  const violations = [];
  for (const file of files) {
    const layout = JSON.parse(await fs.readFile(path.join(qaDir, file), "utf8"));
    for (const element of layout.elements ?? []) {
      const fontSize = Number(element.resolvedFontSize);
      if (!element.text || !Number.isFinite(fontSize)) continue;
      if (fontSize + 1e-6 < minimumFontSize) {
        violations.push({
          slide: file.replace(".layout.json", ""),
          text: element.textPreview ?? element.text,
          fontSize,
          bbox: element.bbox,
        });
      }
    }
  }
  return { status: violations.length ? "failed" : "passed", minimumFontSize, violations };
}

export async function auditRenderedGeometry(qaDir, {
  tolerance = 0.5,
  requireQaParents = false,
  requiredQaSlides = [],
} = {}) {
  const files = await layoutFiles(qaDir);
  const violations = [];
  let qaParentCount = 0;
  let connectorCount = 0;
  const qaParentCountBySlide = {};

  for (const file of files) {
    const layout = JSON.parse(await fs.readFile(path.join(qaDir, file), "utf8"));
    const slideName = file.replace(".layout.json", "");
    const frame = layout.slide?.frame ?? { left: 0, top: 0, width: 1280, height: 720 };
    const frameBox = {
      left: frame.left, top: frame.top, width: frame.width, height: frame.height,
      right: frame.left + frame.width, bottom: frame.top + frame.height,
    };
    const parents = new Map();
    const domains = new Map();
    const contained = [];
    const connectors = [];

    for (const element of layout.elements ?? []) {
      const connector = parseConnectorName(element.name);
      if (connector) {
        connectorCount += 1;
        connectors.push({ element, connector, bbox: box(element) });
      }
      const qa = parseQaName(element.name);
      if (!qa) continue;
      const bbox = box(element);
      if (!bbox) {
        violations.push({ type: "missing-bbox", slide: slideName, element: element.name });
        continue;
      }
      if (qa.parent) {
        qaParentCount += 1;
        if (parents.has(qa.parent)) {
          violations.push({ type: "duplicate-parent", slide: slideName, parent: qa.parent });
        } else {
          parents.set(qa.parent, { element, bbox, qa });
        }
        if (!contains(frameBox, bbox, tolerance)) {
          violations.push({ type: "out-of-slide", slide: slideName, parent: qa.parent, bbox: element.bbox });
        }
        for (const domain of qa.domains ?? []) {
          if (!domains.has(domain)) domains.set(domain, []);
          domains.get(domain).push({ element, bbox, qa });
        }
      }
      if (qa.within) contained.push({ element, bbox, qa });
    }
    qaParentCountBySlide[slideName] = parents.size;
    if (requiredQaSlides.includes(slideName) && parents.size === 0) {
      violations.push({ type: "missing-qa-geometry-contract", slide: slideName });
    }

    for (const [domain, elements] of domains) {
      for (let first = 0; first < elements.length; first += 1) {
        for (let second = first + 1; second < elements.length; second += 1) {
          const area = overlapArea(elements[first].bbox, elements[second].bbox, tolerance);
          if (area > 0) {
            violations.push({
              type: "overlap",
              slide: slideName,
              domain,
              first: elements[first].qa.parent,
              second: elements[second].qa.parent,
              area: Math.round(area * 100) / 100,
            });
          }
        }
      }
    }

    for (const item of contained) {
      const parent = parents.get(item.qa.within);
      if (!parent) {
        violations.push({ type: "missing-parent", slide: slideName, within: item.qa.within, element: item.element.name });
      } else if (!contains(parent.bbox, item.bbox, tolerance)) {
        violations.push({
          type: "child-outside-parent",
          slide: slideName,
          within: item.qa.within,
          role: item.qa.role,
          childBbox: item.element.bbox,
          parentBbox: parent.element.bbox,
        });
      }
    }

    for (const item of connectors) {
      if (!item.bbox) {
        violations.push({ type: "connector-missing-bbox", slide: slideName, connector: item.element.name });
        continue;
      }
      const fromParent = parents.get(item.connector.from);
      const toParent = parents.get(item.connector.to);
      if (!fromParent || !toParent) {
        violations.push({
          type: "connector-missing-parent",
          slide: slideName,
          from: item.connector.from,
          to: item.connector.to,
        });
        continue;
      }
      const expectedFrom = anchor(fromParent.bbox, item.connector.fromSide);
      const expectedTo = anchor(toParent.bbox, item.connector.toSide);
      if (!expectedFrom || !expectedTo) {
        violations.push({ type: "connector-invalid-side", slide: slideName, connector: item.element.name });
        continue;
      }
      const actual = lineEndpoints(item.element, item.bbox);
      const fromDistance = pointDistance(actual.from, expectedFrom);
      const toDistance = pointDistance(actual.to, expectedTo);
      if (fromDistance > tolerance || toDistance > tolerance) {
        violations.push({
          type: "connector-detached",
          slide: slideName,
          from: item.connector.from,
          fromSide: item.connector.fromSide,
          to: item.connector.to,
          toSide: item.connector.toSide,
          fromDistance: Math.round(fromDistance * 100) / 100,
          toDistance: Math.round(toDistance * 100) / 100,
        });
      }
    }
  }

  if (requireQaParents && qaParentCount === 0) violations.push({ type: "missing-qa-geometry-contract" });
  return {
    status: violations.length ? "failed" : "passed",
    tolerance,
    qaParentCount,
    connectorCount,
    qaParentCountBySlide,
    violations,
  };
}

export async function auditRenderedDeck(qaDir, options = {}) {
  const [typography, geometry] = await Promise.all([
    auditRenderedTypography(qaDir, options),
    auditRenderedGeometry(qaDir, options),
  ]);
  return {
    status: typography.status === "passed" && geometry.status === "passed" ? "passed" : "failed",
    typography,
    geometry,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const qaDir = path.resolve(process.argv[2] ?? "");
  if (!process.argv[2]) throw new Error("用法：node audit-rendered-typography.mjs <qa-dir>");
  const result = await auditRenderedDeck(qaDir);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.status !== "passed") process.exitCode = 1;
}
