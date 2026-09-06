import fs from 'node:fs/promises';

// Text/text intersections are review candidates, not automatic aesthetic grades.
// Includes full exported text frames so readers can investigate empty-frame hits.
const files = process.argv.slice(2);
if (!files.length) throw new Error('Provide exported slide layout JSON paths');
const results = [];
for (const file of files) {
  const layout = JSON.parse((await fs.readFile(file, 'utf8')).replace(/^\uFEFF/, ''));
  const text = layout.elements.filter(e => e.text?.trim() && Array.isArray(e.bbox));
  // Exported line counts permit a capacity estimate even without glyph boxes.
  // Use the largest run size/spacing for mixed text. Warnings require review;
  // font metrics and paragraph spacing can make the true height different.
  const textCapacityWarnings = [];
  let textCapacityUnchecked = 0;
  for (const e of text) {
    const count = e.textLayout?.lineCount;
    const fontSize = Math.max(Number(e.resolvedFontSize ?? 0),
      ...(e.paragraphs ?? []).flatMap(p => (p.runs ?? []).map(r => Number(r.fontSize ?? 0))));
    if (!Number.isFinite(count) || count < 1 || !Number.isFinite(fontSize) || fontSize <= 0) {
      textCapacityUnchecked++;
      continue;
    }
    const spacing = Math.max(1, ...(e.paragraphs ?? []).map(p =>
      p.lineSpacingPercent ? p.lineSpacingPercent / 100000 : Number(p.resolvedTextStyle?.lineSpacing ?? 1)));
    const ins = e.resolvedTextStyle?.insets ?? {};
    const availableHeight = e.bbox[3] - (ins.top ?? 0) - (ins.bottom ?? 0);
    const estimatedMinimumHeight = fontSize + (count - 1) * fontSize * spacing;
    if (estimatedMinimumHeight > availableHeight + 1) textCapacityWarnings.push({
      id:e.id,name:e.name,text:e.text,lineCount:count,fontSize,lineSpacing:spacing,
      availableHeight,estimatedMinimumHeight,excess:estimatedMinimumHeight-availableHeight,
      measurement:'estimate from exported line count; glyph bounds not measured',
    });
  }
  const intersections = [];
  for (let i=0;i<text.length;i++) for(let j=i+1;j<text.length;j++) {
    const a=text[i], b=text[j];
    const [ax,ay,aw,ah]=a.bbox, [bx,by,bw,bh]=b.bbox;
    const width=Math.min(ax+aw,bx+bw)-Math.max(ax,bx);
    const height=Math.min(ay+ah,by+bh)-Math.max(ay,by);
    if(width>1 && height>1) intersections.push({
      a:{id:a.id,text:a.text,bbox:a.bbox},b:{id:b.id,text:b.text,bbox:b.bbox},width,height,
    });
  }
  // Only axis-aligned lines and thin rectangles; diagonal connectors need their
  // actual path/endpoints. A zero candidate count is not complete visual QA.
  const rules = layout.elements.filter(e => !e.text?.trim() && Array.isArray(e.bbox)
    && ['rect','line','straightConnector1'].includes(e.geometry)
    && Math.min(e.bbox[2], e.bbox[3]) <= 4 && Math.max(e.bbox[2], e.bbox[3]) >= 8);
  const textRuleIntersections = [];
  const textRuleClearanceCandidates = [];
  for (const a of text) for (const b of rules) {
    const [ax,ay,aw,ah] = a.bbox;
    let [bx,by,bw,bh] = b.bbox;
    const stroke = Math.max(1, Number(b.lineWidth ?? 1));
    if (bw === 0) {bx -= stroke/2; bw = stroke;}
    if (bh === 0) {by -= stroke/2; bh = stroke;}
    const width = Math.min(ax+aw,bx+bw)-Math.max(ax,bx);
    const height = Math.min(ay+ah,by+bh)-Math.max(ay,by);
    if (width > 0 && height > 0) textRuleIntersections.push({
      text:{id:a.id,text:a.text,bbox:a.bbox},rule:{id:b.id,name:b.name,bbox:b.bbox},width,height,
    });
    else {
      const gapX = Math.max(ax-(bx+bw), bx-(ax+aw), 0);
      const gapY = Math.max(ay-(by+bh), by-(ay+ah), 0);
      if ((width > 0 && gapY < 8) || (height > 0 && gapX < 8)) textRuleClearanceCandidates.push({
        text:{id:a.id,text:a.text,bbox:a.bbox},rule:{id:b.id,name:b.name,bbox:b.bbox},gapX,gapY,
      });
    }
  }
  results.push({file,textFrames:text.length,textCapacityWarningCount:textCapacityWarnings.length,
    textCapacityUnchecked,textCapacityWarnings,intersectionCount:intersections.length,intersections,
    textRuleIntersectionCount:textRuleIntersections.length,textRuleIntersections,
    textRuleClearanceCount:textRuleClearanceCandidates.length,textRuleClearanceCandidates});
}
console.log(JSON.stringify(results,null,2));
