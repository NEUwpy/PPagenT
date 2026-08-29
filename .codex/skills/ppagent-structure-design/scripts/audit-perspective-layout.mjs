#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

// Audits model A only: a straight, single-recession band with attached nodes.
// Other perspective families require their own geometry and invariants.

function finite(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`${label} 必须是有限数值`);
  return number;
}

function point(value, label) {
  return { x: finite(value?.x, `${label}.x`), y: finite(value?.y, `${label}.y`) };
}

function interpolate(edge, t, label) {
  const near = point(edge?.near, `${label}.near`);
  const far = point(edge?.far, `${label}.far`);
  return {
    x: near.x + (far.x - near.x) * t,
    y: near.y + (far.y - near.y) * t,
  };
}

function intersectHorizontal(edge, y, label) {
  const near = point(edge?.near, `${label}.near`);
  const far = point(edge?.far, `${label}.far`);
  const deltaY = far.y - near.y;
  if (Math.abs(deltaY) < 0.000001) throw new Error(`${label} 不能与横截线平行`);
  const ratio = (y - near.y) / deltaY;
  return {
    x: near.x + (far.x - near.x) * ratio,
    y,
  };
}

function mix(left, right, ratio) {
  return {
    x: left.x + (right.x - left.x) * ratio,
    y: left.y + (right.y - left.y) * ratio,
  };
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function auditPerspectiveLayout(config) {
  const leftEdge = config?.shaft?.left;
  const rightEdge = config?.shaft?.right;
  const samples = Array.isArray(config?.samples) ? config.samples : [];
  if (!leftEdge || !rightEdge) throw new Error("缺少 shaft.left / shaft.right");
  if (samples.length < 2) throw new Error("至少需要两个透视采样节点");

  const tolerance = finite(config?.centerTolerance ?? 0.75, "centerTolerance");
  const minDropRatio = finite(config?.minAdjacentScaleDropRatio ?? 0, "minAdjacentScaleDropRatio");
  const requireSpacingCompression = config?.requireSpacingCompression === true;
  const crossSectionMode = config?.crossSectionMode ?? "edge-progress";
  if (!['edge-progress', 'horizontal'].includes(crossSectionMode)) {
    throw new Error("crossSectionMode 仅支持 edge-progress / horizontal");
  }
  const frame = config?.frame
    ? { width: finite(config.frame.width, "frame.width"), height: finite(config.frame.height, "frame.height") }
    : null;
  const axis = config?.axis
    ? { near: point(config.axis.near, "axis.near"), far: point(config.axis.far, "axis.far") }
    : null;

  const rows = samples.map((sample, index) => {
    const t = finite(sample?.t, `samples[${index}].t`);
    const worldT = finite(sample?.worldT ?? t, `samples[${index}].worldT`);
    if (t < 0 || t > 1) throw new Error(`samples[${index}].t 必须位于 0–1`);
    if (worldT < 0 || worldT > 1) throw new Error(`samples[${index}].worldT 必须位于 0–1`);
    const node = point(sample?.node, `samples[${index}].node`);
    const sectionY = finite(sample?.sectionY ?? node.y, `samples[${index}].sectionY`);
    const left = crossSectionMode === "horizontal"
      ? intersectHorizontal(leftEdge, sectionY, "shaft.left")
      : interpolate(leftEdge, t, "shaft.left");
    const right = crossSectionMode === "horizontal"
      ? intersectHorizontal(rightEdge, sectionY, "shaft.right")
      : interpolate(rightEdge, t, "shaft.right");
    const centerRatio = finite(sample?.centerRatio ?? 0.5, `samples[${index}].centerRatio`);
    const expectedCenter = axis ? interpolate(axis, t, "axis") : mix(left, right, centerRatio);
    const size = finite(sample?.node?.size, `samples[${index}].node.size`);
    const localWidth = distance(left, right);
    const centerError = distance(node, expectedCenter);
    const radiusFactor = finite(sample?.visualRadiusFactor ?? 0.5, `samples[${index}].visualRadiusFactor`);
    const visualCenter = sample?.visualCenter ? point(sample.visualCenter, `samples[${index}].visualCenter`) : node;
    const anchorOffsetRatio = finite(sample?.anchorOffsetRatio ?? 0, `samples[${index}].anchorOffsetRatio`);
    const axisError = Math.abs(visualCenter.x - node.x);
    const anchorError = Math.abs(visualCenter.y + size * anchorOffsetRatio - node.y);

    if (size <= 0) throw new Error(`samples[${index}].node.size 必须大于 0`);
    if (centerError > tolerance) {
      throw new Error(`${sample?.id ?? index + 1} 接触锚点偏离目标中轴 ${centerError.toFixed(2)}px`);
    }
    if (axisError > tolerance || anchorError > tolerance) {
      throw new Error(`${sample?.id ?? index + 1} 主体中心与接触锚点未按统一偏移对齐`);
    }
    if (frame) {
      const visualRadius = size * radiusFactor;
      if (visualCenter.x - visualRadius < 0 || visualCenter.x + visualRadius > frame.width
        || visualCenter.y - visualRadius < 0 || visualCenter.y + visualRadius > frame.height) {
        throw new Error(`${sample?.id ?? index + 1} 的可见外轮廓超出画布`);
      }
    }

    return {
      id: String(sample?.id ?? index + 1),
      t,
      worldT,
      leftX: left.x,
      rightX: right.x,
      localWidth,
      expectedX: expectedCenter.x,
      actualX: node.x,
      actualY: node.y,
      centerError,
      anchorError,
      size,
    };
  });

  for (let index = 1; index < rows.length; index += 1) {
    const previous = rows[index - 1];
    const current = rows[index];
    if (current.t <= previous.t) throw new Error("采样节点必须按 t 从近到远递增");
    if (current.worldT <= previous.worldT) throw new Error("采样节点必须按 worldT 从近到远递增");
    if (current.localWidth >= previous.localWidth) throw new Error("箭带局部宽度没有由近到远严格收缩");
    if (current.size >= previous.size) throw new Error("节点尺寸没有由近到远严格缩小");
    const dropRatio = (previous.size - current.size) / previous.size;
    if (dropRatio < minDropRatio) {
      throw new Error(`${current.id} 相对前一节点只缩小 ${(dropRatio * 100).toFixed(1)}%，低于可辨认阈值`);
    }
  }

  if (requireSpacingCompression && rows.length > 2) {
    const worldGaps = rows.slice(1).map((row, index) => row.worldT - rows[index].worldT);
    const baselineWorldGap = worldGaps[0];
    if (worldGaps.some((gap) => Math.abs(gap - baselineWorldGap) > 0.000001)) {
      throw new Error("requireSpacingCompression 只适用于等距 worldT 节点");
    }
    const screenGaps = rows.slice(1).map((row, index) => Math.hypot(
      row.actualX - rows[index].actualX,
      row.actualY - rows[index].actualY,
    ));
    for (let index = 1; index < screenGaps.length; index += 1) {
      if (screenGaps[index] >= screenGaps[index - 1]) {
        throw new Error("等距世界节点投影后的画面间距没有向远端严格压缩");
      }
    }
  }

  return rows;
}

function printRows(rows) {
  console.table(rows.map((row) => ({
    id: row.id,
    worldT: row.worldT.toFixed(2),
    t: row.t.toFixed(2),
    left: row.leftX.toFixed(2),
    right: row.rightX.toFixed(2),
    width: row.localWidth.toFixed(2),
    expectedX: row.expectedX.toFixed(2),
    actualX: row.actualX.toFixed(2),
    centerError: row.centerError.toFixed(3),
    anchorError: row.anchorError.toFixed(3),
    size: row.size.toFixed(2),
  })));
}

function selfTest() {
  const valid = {
    frame: { width: 1170, height: 492 },
    shaft: {
      left: { near: { x: 150.09, y: 489.34 }, far: { x: 839.27, y: 190.2 } },
      right: { near: { x: 538.06, y: 487.91 }, far: { x: 934.71, y: 190.2 } },
    },
    axis: {
      near: { x: 344.075, y: 488.625 },
      far: { x: 886.99, y: 190.2 },
    },
    crossSectionMode: "horizontal",
    centerTolerance: 0.01,
    minAdjacentScaleDropRatio: 0.08,
    requireSpacingCompression: true,
    samples: [
      { id: "near", worldT: 0, t: 0.28, node: { x: 496.0912, y: 405.066, size: 154.466388 }, visualCenter: { x: 496.0912, y: 337.100789 }, anchorOffsetRatio: 0.44, visualRadiusFactor: 0.55 },
      { id: "mid", worldT: 0.5, t: 0.6082173893, node: { x: 674.285344, y: 307.117726, size: 121.160352 }, visualCenter: { x: 674.285344, y: 253.807171 }, anchorOffsetRatio: 0.44, visualRadiusFactor: 0.55 },
      { id: "far", worldT: 1, t: 0.82, node: { x: 789.2653, y: 243.9165, size: 99.669597 }, visualCenter: { x: 789.2653, y: 200.061877 }, anchorOffsetRatio: 0.44, visualRadiusFactor: 0.55 },
    ],
  };
  const rows = auditPerspectiveLayout(valid);
  if (rows.length !== 3) throw new Error("自检没有返回三个节点");
  let rejected = false;
  try {
    auditPerspectiveLayout({
      ...valid,
      samples: valid.samples.map((sample, index) => index === 2
        ? { ...sample, node: { ...sample.node, x: sample.node.x - 24 } }
        : sample),
    });
  } catch {
    rejected = true;
  }
  if (!rejected) throw new Error("自检未能拦截偏离中点的节点");
  console.log("Perspective audit self-test passed");
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  if (process.argv[2] === "--self-test") {
    selfTest();
  } else {
    const inputPath = process.argv[2];
    if (!inputPath) throw new Error("用法: node audit-perspective-layout.mjs <audit.json> 或 --self-test");
    const config = JSON.parse(fs.readFileSync(path.resolve(inputPath), "utf8"));
    const rows = auditPerspectiveLayout(config);
    printRows(rows);
    console.log(`Perspective audit passed: ${rows.length} samples`);
  }
}
