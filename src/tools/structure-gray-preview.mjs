import { addBox, addText } from '../asset-runtime/component-builders.mjs';
import { resolveLayoutTree } from '../composition/resolve.mjs';
import { fitChineseTextToFrame } from '../render/chinese-typography.mjs';

export const grayPreviewAssetId = 'matrix-quadrant-priority-001';

const grayPlan = Object.freeze({
  title: '高价值、低难度事项应优先推进',
  structureHeading: '项目组合定位',
  medium: [
    { heading: '判断依据', body: '用业务价值与实施难度两轴定位事项，再决定投入顺序。' },
    { heading: '优先动作', body: '异常预警位于高价值、低难度象限，适合先行试点。' },
    { heading: '投入边界', body: '数据平台需要集中资源；系统重构先验证收益与复用范围。' },
  ],
  small: [
    { heading: '判断依据', body: '按业务价值和实施难度定位事项，再确定先后顺序。' },
    { heading: '行动解释', body: '异常预警先行；数据平台重点投入；系统重构先验证收益。' },
  ],
});

export function isGrayPreview(assetId, size, composition) {
  return assetId === grayPreviewAssetId && ['medium', 'small'].includes(size) && composition === 'gray';
}

export function grayPreviewParameters(parameters) {
  return {
    ...parameters,
    showDefinitionRail: false,
    // The gray-draft text owns the explanations; the local structure keeps only
    // the axes, quadrant names and one representative item in each quadrant.
    quadrants: parameters.quadrants.map((quadrant) => ({
      ...quadrant,
      detail: { title: '', body: '', metrics: [] },
    })),
  };
}

export function grayPreviewTitle() {
  return grayPlan.title;
}

function fittedText(value, frame, fontSizes, maxLines) {
  const fitted = fitChineseTextToFrame(value, { ...frame, fontSizes, maxLines, lineHeight: 1.22 });
  if (!fitted?.fits) throw new Error(`模拟灰稿文字无法排下：${value}`);
  return fitted;
}

/** Pilot only: use the existing gray-layout solver to reserve a real text region beside one structure. */
export function renderGrayPreview(slide, skin, size, structureSize) {
  const body = skin.bodyFrame;
  const cards = grayPlan[size];
  const layout = resolveLayoutTree({
    composition: { op: 'row', weights: [0.001, 1], children: [{ groupId: 'structure' }, { groupId: 'explanation' }] },
    bodyFrame: body,
    contracts: {
      structure: { minWidth: structureSize.width, minHeight: structureSize.height },
      explanation: { minWidth: size === 'medium' ? 280 : 300, minHeight: 350 },
    },
    style: { gap: 26 },
  });
  const structureRegion = layout.regions.structure;
  const explanation = layout.regions.explanation;
  const structureFrame = {
    ...structureSize,
    left: structureRegion.left + (structureRegion.width - structureSize.width) / 2,
    top: structureRegion.top + (structureRegion.height - structureSize.height) / 2,
  };
  addText(slide, grayPlan.structureHeading, {
    left: structureRegion.left + 18, top: body.top + 13, width: structureRegion.width - 36, height: 34,
  }, { name: 'gray-preview-structure-heading', typeface: skin.typographyRoles.bodyTypeface,
    fontSize: 21, bold: true, color: '#4B5563', autoFit: 'none' });

  const gap = size === 'medium' ? 16 : 20;
  const cardHeight = size === 'medium' ? 132 : 164;
  const groupHeight = cards.length * cardHeight + (cards.length - 1) * gap;
  const groupTop = explanation.top + (explanation.height - groupHeight) / 2;
  cards.forEach((card, index) => {
    const frame = { left: explanation.left, top: groupTop + index * (cardHeight + gap), width: explanation.width, height: cardHeight };
    addBox(slide, frame, { geometry: 'rect', name: `gray-preview-card-${index + 1}`,
      fill: '#F3F4F6', line: { style: 'solid', fill: '#D9DDE2', width: 1 }, shadow: 'none' });
    const headingFrame = { left: frame.left + 18, top: frame.top + 15, width: frame.width - 36, height: 31 };
    const bodyFrame = { left: frame.left + 18, top: frame.top + 55, width: frame.width - 36, height: frame.height - 70 };
    const heading = fittedText(card.heading, headingFrame, [20, 19], 1);
    const paragraph = fittedText(card.body, bodyFrame, [18, 17, 16], 4);
    addText(slide, heading.text, headingFrame, { name: `gray-preview-heading-${index + 1}`,
      typeface: skin.typographyRoles.bodyTypeface, fontSize: heading.fontSize, bold: true,
      color: '#374151', autoFit: 'none' });
    addText(slide, paragraph.text, bodyFrame, { name: `gray-preview-body-${index + 1}`,
      typeface: skin.typographyRoles.bodyTypeface, fontSize: paragraph.fontSize,
      color: '#4B5563', verticalAlignment: 'top', autoFit: 'none' });
  });
  return structureFrame;
}
