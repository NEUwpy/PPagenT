const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#039;",
})[character]);

const itemCards = (items, className = "") => items.map((item, index) => `<article class="${className}">
  <span class="number">${String(index + 1).padStart(2, "0")}</span>
  <h3>${escapeHtml(item.title)}</h3>
  <p>${escapeHtml(item.body)}</p>
</article>`).join("");

function renderMarkup(kind, parameters) {
  if (kind === "parallel") {
    return `<section class="review-root parallel" style="--count:${parameters.items.length}">${itemCards(parameters.items)}</section>`;
  }
  if (kind === "sequence") {
    return `<section class="review-root sequence" style="--count:${parameters.steps.length}">${itemCards(parameters.steps)}</section>`;
  }
  if (kind === "comparison") {
    const list = (items) => items.map((item) => `<li>${escapeHtml(typeof item === "string" ? item : item.title ?? item.body)}</li>`).join("");
    return `<section class="review-root comparison"><article class="comparison-panel muted"><h3>${escapeHtml(parameters.left.title)}</h3><ul>${list(parameters.left.items)}</ul></article><div class="comparison-vs">${escapeHtml(parameters.centerLabel ?? "VS")}</div><article class="comparison-panel primary"><h3>${escapeHtml(parameters.right.title)}</h3><ul>${list(parameters.right.items)}</ul></article></section>`;
  }
  if (kind === "hierarchy") {
    return `<section class="review-root hierarchy"><div class="pyramid">${parameters.levels.map((item, index) => `<div class="tier" style="--tier:${index};--tiers:${parameters.levels.length}">${escapeHtml(item.title)}</div>`).join("")}</div><div class="hierarchy-notes">${parameters.levels.map((item) => `<article><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.body)}</p></article>`).join("")}</div></section>`;
  }
  if (kind === "cycle") {
    const sides = [parameters.steps.filter((_, index) => index % 2 === 0), parameters.steps.filter((_, index) => index % 2 === 1)];
    const sideMarkup = (steps) => steps.map((item) => `<article><b>${String(parameters.steps.indexOf(item) + 1).padStart(2, "0")}</b><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.body)}</p></article>`).join("");
    return `<section class="review-root cycle"><div class="cycle-side">${sideMarkup(sides[0])}</div><div class="cycle-ring"><span>${escapeHtml(parameters.center)}</span></div><div class="cycle-side">${sideMarkup(sides[1])}</div></section>`;
  }
  if (kind === "matrix") {
    return `<section class="review-root matrix"><div class="matrix-copy">${parameters.quadrants.slice(0, 2).map((item) => `<article><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.body)}</p></article>`).join("")}</div><div class="matrix-petals">${parameters.quadrants.map((item) => `<span><b>${escapeHtml(Array.from(item.title)[0] ?? "•")}</b></span>`).join("")}</div><div class="matrix-copy">${parameters.quadrants.slice(2, 4).map((item) => `<article><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.body)}</p></article>`).join("")}</div></section>`;
  }
  if (kind === "fishbone") {
    return `<section class="review-root fishbone"><div class="fishbone-spine"></div><div class="fishbone-effect">${escapeHtml(parameters.effect)}</div>${parameters.branches.map((branch, index) => `<article class="fishbone-branch ${index % 2 ? "down" : "up"}" style="--column:${Math.floor(index / 2)};--columns:${Math.ceil(parameters.branches.length / 2)}"><h3>${escapeHtml(branch.category)}</h3><p>${escapeHtml(branch.items.join(" · "))}</p></article>`).join("")}</section>`;
  }
  if (kind === "layered") {
    const nodes = (items, className) => `<div class="layer-nodes ${className}" style="--count:${items.length}">${items.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>`;
    return `<section class="review-root layered">${nodes(parameters.apps, "apps")}<div class="platform">${escapeHtml(parameters.platform)}</div>${nodes(parameters.sources, "sources")}</section>`;
  }
  if (kind === "organization") {
    return `<section class="review-root organization"><div class="leader"><b>${escapeHtml(parameters.leader.name)}</b><span>${escapeHtml(parameters.leader.role)}</span></div><div class="departments" style="--count:${parameters.departments.length}">${parameters.departments.map((department) => `<article><h3>${escapeHtml(department.name)}</h3><p>${escapeHtml(department.head)}</p><div class="members">${department.members.map((member) => `<span><b>${escapeHtml(member.name)}</b><small>${escapeHtml(member.role)}</small></span>`).join("")}</div></article>`).join("")}</div></section>`;
  }
  if (kind === "radial") {
    return `<section class="review-root radial"><div class="radial-center">${escapeHtml(parameters.center)}</div>${parameters.items.map((item, index) => `<div class="radial-node" style="--index:${index};--count:${parameters.items.length}">${escapeHtml(typeof item === "string" ? item : item.title ?? item.body)}</div>`).join("")}</section>`;
  }
  if (kind === "swimlane") {
    const taskMap = new Map(parameters.tasks.map((task) => [`${task.lane}:${task.stage}`, task.label]));
    return `<section class="review-root swimlane" style="--stages:${parameters.stages.length}"><div class="swimlane-head"></div>${parameters.stages.map((stage) => `<b class="stage-head">${escapeHtml(stage)}</b>`).join("")}${parameters.lanes.map((lane, laneIndex) => `<div class="lane-name">${escapeHtml(lane)}</div>${parameters.stages.map((_, stageIndex) => `<div class="task-cell">${taskMap.has(`${laneIndex}:${stageIndex}`) ? `<span>${escapeHtml(taskMap.get(`${laneIndex}:${stageIndex}`))}</span>` : ""}</div>`).join("")}`).join("")}${parameters.conclusion ? `<div class="swimlane-conclusion">${escapeHtml(parameters.conclusion)}</div>` : ""}</section>`;
  }
  if (kind === "timeline") {
    return `<section class="review-root timeline" style="--count:${parameters.milestones.length}"><div class="timeline-line"></div>${parameters.milestones.map((item, index) => `<article class="${index % 2 ? "below" : "above"}"><span>${escapeHtml(item.period)}</span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.body)}</p></article>`).join("")}</section>`;
  }
  if (kind === "funnel") {
    return `<section class="review-root funnel" style="--count:${parameters.stages.length}">${parameters.stages.map((item, index) => `<article style="--index:${index}"><b>${escapeHtml(item.rate)}</b><h3>${escapeHtml(item.label)}</h3><p>${escapeHtml(item.note)}</p></article>`).join("")}</section>`;
  }
  if (kind === "problem-improvement") {
    const column = (title, items, tone) => `<article class="problem-column ${tone}"><h3>${escapeHtml(title)}</h3>${items.map((item, index) => `<div><b>${String(index + 1).padStart(2, "0")} · ${escapeHtml(item.title)}</b><p>${escapeHtml(item.body)}</p></div>`).join("")}</article>`;
    return `<section class="review-root problem-improvement">${column(parameters.problemTitle, parameters.problems, "problem")}<div class="improvement-arrow">→</div>${column(parameters.improvementTitle, parameters.improvements, "improvement")}</section>`;
  }
  throw new Error(`未知 HTML 审查组件类型：${kind}`);
}

export const STRUCTURE_GROUP_REVIEW_CSS = `
*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden}body{font-family:"Microsoft YaHei",sans-serif;background:#fff;color:#16365f}.review-root{position:relative;width:100%;height:100%;padding:24px 23px 30px;overflow:hidden}.review-root h3,.review-root p{margin:0}
.parallel,.sequence{display:grid;grid-template-columns:repeat(var(--count),minmax(0,1fr));gap:20px}.parallel article,.sequence article{position:relative;padding:120px 20px 20px;border:1.4px solid #a8cbea;border-top:8px solid #2f5ea8;border-radius:14px;background:#f7fbff;box-shadow:0 4px 12px #1e5b9624}.parallel article:nth-child(even){border-color:#7eb7ed;border-top-color:#4c88e8;background:#f1f8ff}.parallel .number,.sequence .number{position:absolute;left:20px;top:32px;width:54px;height:54px;display:grid;place-items:center;border:2px solid #fff;border-radius:50%;background:#2f5ea8;color:#fff;font-weight:700}.parallel h3,.sequence h3{min-height:55px;color:#174d87;font-size:22px;text-align:center}.parallel p,.sequence p{margin-top:17px;color:#607895;font-size:17px;line-height:1.5;text-align:center}.sequence{align-items:center;gap:28px}.sequence article{height:320px;border:0;background:linear-gradient(180deg,#1689e8,#0d61be);color:#fff;text-align:center}.sequence article:nth-child(even){background:linear-gradient(180deg,#3f94eb,#276dc5)}.sequence article:not(:last-child)::after{content:"";position:absolute;right:-24px;top:46%;border-top:14px solid transparent;border-bottom:14px solid transparent;border-left:20px solid #41a5ef}.sequence .number{background:#fff;color:#1677c8}.sequence h3{color:#fff}.sequence p{color:#eaf6ff}
.comparison{display:grid;grid-template-columns:1fr 112px 1fr;gap:24px;align-items:center}.comparison-panel{height:390px;padding:24px;border:1px solid #d6dce3;border-radius:16px;background:#f6f7f8}.comparison-panel.primary{border-color:#b9d9fb;background:#f1f8ff}.comparison-panel h3{padding:14px;border-radius:10px;background:#777;color:#fff;font-size:24px;text-align:center}.comparison-panel.primary h3{background:#1682dd}.comparison-panel ul{margin:18px 0 0;padding:0}.comparison-panel li{margin:12px 0;padding:10px 14px;border-radius:999px;background:#888;color:#fff;font-size:16px;list-style:none}.comparison-panel.primary li{background:#1677c8}.comparison-vs{width:96px;height:96px;display:grid;place-items:center;border-radius:50%;background:#08a9dc;color:#fff;font-size:26px;font-weight:900;box-shadow:0 10px 22px #0796cd55}
.hierarchy{display:grid;grid-template-columns:54% 46%;gap:34px;align-items:center}.pyramid{height:430px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px}.tier{width:calc(38% + var(--tier) * 13%);flex:1;display:grid;place-items:center;border-radius:50% 50% 16px 16px/18% 18% 16px 16px;background:linear-gradient(180deg,#398ff5,#146bd2);color:#fff;font-size:19px;font-weight:900;box-shadow:0 8px 16px #1e76da28}.hierarchy-notes{display:flex;flex-direction:column;gap:9px}.hierarchy-notes article{flex:1;min-height:68px;padding:12px 18px;border:1px solid #d7e5f2;border-radius:10px;background:#f8fbfe}.hierarchy-notes h3{color:#126ac7;font-size:19px}.hierarchy-notes p{margin-top:4px;color:#657b92;font-size:15px}
.cycle{display:grid;grid-template-columns:1fr 380px 1fr;gap:26px;align-items:center}.cycle-side{display:flex;flex-direction:column;gap:14px}.cycle-side article{display:grid;grid-template-columns:42px 1fr;column-gap:12px;padding:12px 14px;border:1px solid #d5e5f4;border-radius:12px;background:#fff;box-shadow:0 8px 16px #156cb316}.cycle-side b{grid-row:1/3;width:42px;height:42px;display:grid;place-items:center;border-radius:50%;background:#1677c8;color:#fff}.cycle-side h3{color:#126fc9;font-size:18px}.cycle-side p{margin-top:3px;color:#6d8198;font-size:14px}.cycle-ring{width:320px;height:320px;margin:auto;display:grid;place-items:center;border:42px solid #2f7eea;border-radius:50%;background:#e8f3ff;box-shadow:0 12px 26px #186ac62b}.cycle-ring span{width:190px;height:190px;display:grid;place-items:center;border-radius:50%;background:#1677c8;color:#fff;font-size:23px;font-weight:900;text-align:center}
.matrix{display:grid;grid-template-columns:1fr 350px 1fr;gap:24px;align-items:center}.matrix-copy{display:flex;flex-direction:column;gap:24px}.matrix-copy article{padding:19px;border:1px dashed #b9c7d4;border-radius:14px;background:#fff;box-shadow:0 8px 18px #124d7e12}.matrix-copy h3{color:#1677c8;font-size:21px}.matrix-copy p{margin-top:8px;color:#667d95;font-size:16px;line-height:1.45}.matrix-petals{width:330px;height:330px;display:grid;grid-template:1fr 1fr/1fr 1fr;gap:4px;transform:rotate(45deg)}.matrix-petals span{display:grid;place-items:center;border-radius:65% 10% 65% 10%;background:linear-gradient(135deg,#1479d4,#13b8d5);color:#fff;font-size:36px}.matrix-petals b{transform:rotate(-45deg)}
.fishbone-spine{position:absolute;left:45px;right:185px;top:50%;height:7px;background:#1677c8}.fishbone-effect{position:absolute;right:8px;top:calc(50% - 55px);width:205px;height:110px;display:grid;place-items:center;clip-path:polygon(0 0,78% 0,100% 50%,78% 100%,0 100%,13% 50%);background:#1677c8;color:#fff;font-size:22px;font-weight:900}.fishbone-branch{position:absolute;left:calc(55px + var(--column) * ((100% - 285px) / var(--columns)));width:calc((100% - 300px) / var(--columns) - 18px);padding:10px 12px;border:1px solid #bcd4e8;background:#f6f9fc;box-shadow:0 6px 12px #1866a512}.fishbone-branch.up{bottom:58%}.fishbone-branch.down{top:58%}.fishbone-branch h3{color:#1677c8;font-size:18px;text-align:center}.fishbone-branch p{margin-top:4px;color:#60758d;font-size:14px;text-align:center}.fishbone-branch::after{content:"";position:absolute;left:50%;width:3px;height:64px;background:#1fa7d5}.fishbone-branch.up::after{top:100%;transform:rotate(-28deg);transform-origin:top}.fishbone-branch.down::after{bottom:100%;transform:rotate(28deg);transform-origin:bottom}
.layered{display:grid;grid-template-rows:1fr 112px 1fr;gap:15px;align-items:center}.layer-nodes{display:grid;grid-template-columns:repeat(var(--count),1fr);gap:18px}.layer-nodes span{height:80px;display:grid;place-items:center;border-radius:50%;background:#17aeca;color:#fff;font-size:17px;font-weight:900;text-align:center;box-shadow:0 9px 18px #1592b92e}.layer-nodes.sources span{background:#1677c8}.platform{width:72%;height:100%;margin:auto;display:grid;place-items:center;border-radius:18px;background:linear-gradient(90deg,#1677c8,#18b4d2);color:#fff;font-size:27px;font-weight:900;box-shadow:0 12px 24px #147ac13d}
.organization{display:grid;grid-template-rows:92px 1fr;gap:30px}.leader{position:relative;width:280px;margin:auto;display:grid;place-items:center;border-radius:14px;background:linear-gradient(90deg,#1c6fc4,#3b98e8);color:#fff;box-shadow:0 9px 20px #1669b635}.leader::after{content:"";position:absolute;left:50%;top:100%;width:2px;height:30px;background:#8fbce7}.leader b{font-size:21px}.leader span{font-size:14px;color:#e7f4ff}.departments{position:relative;display:grid;grid-template-columns:repeat(var(--count),1fr);gap:18px}.departments::before{content:"";position:absolute;left:calc(50% / var(--count));right:calc(50% / var(--count));top:-16px;height:2px;background:#8fbce7}.departments article{position:relative;padding:14px;border:1px solid #bcd6ee;border-radius:12px;background:#f7fbff;text-align:center}.departments article::before{content:"";position:absolute;left:50%;bottom:100%;width:2px;height:16px;background:#8fbce7}.departments h3{color:#176ebd;font-size:18px}.departments p{margin-top:3px;color:#7390aa;font-size:13px}.members{display:grid;gap:7px;margin-top:12px}.members span{padding:8px;border-radius:8px;background:#fff;box-shadow:0 3px 9px #165f9d17}.members b,.members small{display:block}.members b{font-size:14px}.members small{margin-top:2px;color:#7a8fa5;font-size:11px}
.radial{--radius:175px}.radial-center{position:absolute;left:50%;top:50%;width:190px;height:190px;display:grid;place-items:center;transform:translate(-50%,-50%);border:24px solid #d9efff;border-radius:50%;background:linear-gradient(135deg,#176fc7,#20b2d5);color:#fff;font-size:24px;font-weight:900;text-align:center;box-shadow:0 10px 28px #176dbb42}.radial-node{position:absolute;left:50%;top:50%;width:142px;height:66px;display:grid;place-items:center;transform:translate(-50%,-50%) rotate(calc(360deg / var(--count) * var(--index))) translateX(var(--radius)) rotate(calc(-360deg / var(--count) * var(--index)));border:1px solid #a9d1ee;border-radius:999px;background:#f7fbff;color:#1766aa;font-size:16px;font-weight:700;text-align:center;box-shadow:0 6px 15px #176ba522}
.swimlane{display:grid;grid-template-columns:150px repeat(var(--stages),1fr);grid-auto-rows:minmax(62px,1fr);gap:7px}.swimlane-head,.stage-head,.lane-name,.task-cell{display:grid;place-items:center;border-radius:8px}.stage-head{background:#176fc7;color:#fff;font-size:16px}.lane-name{background:#e8f3fd;color:#1767ad;font-weight:700}.task-cell{border:1px solid #d6e6f4;background:#fbfdff}.task-cell span{margin:8px;padding:9px;border-radius:7px;background:#38a2e8;color:#fff;font-size:13px;text-align:center}.swimlane-conclusion{grid-column:1/-1;padding:10px;border-radius:8px;background:#173e6b;color:#fff;text-align:center}
.timeline{display:grid;grid-template-columns:repeat(var(--count),1fr);gap:16px;align-items:center}.timeline-line{position:absolute;left:60px;right:60px;top:50%;height:5px;border-radius:5px;background:linear-gradient(90deg,#176fc7,#22b5d4)}.timeline article{position:relative;height:178px;padding:16px;border:1px solid #c6dcf0;border-radius:12px;background:#fff;box-shadow:0 7px 18px #1765a61f}.timeline article.above{align-self:start}.timeline article.below{align-self:end}.timeline article::after{content:"";position:absolute;left:50%;width:16px;height:16px;border:4px solid #fff;border-radius:50%;background:#1889d4;box-shadow:0 0 0 3px #9dd5f2}.timeline article.above::after{top:calc(100% + 37px)}.timeline article.below::after{bottom:calc(100% + 37px)}.timeline span{color:#19a7cf;font-size:15px;font-weight:900}.timeline h3{margin-top:7px;color:#1767ad;font-size:18px}.timeline p{margin-top:7px;color:#687f96;font-size:14px;line-height:1.4}
.funnel{display:flex;flex-direction:column;align-items:center;gap:7px;padding-top:10px}.funnel article{width:calc(100% - var(--index) * (68% / var(--count)));min-width:30%;flex:1;display:grid;grid-template-columns:100px 170px 1fr;align-items:center;padding:7px 50px;clip-path:polygon(3% 0,97% 0,91% 100%,9% 100%);background:linear-gradient(90deg,#176fc7,#21add2);color:#fff}.funnel article:nth-child(even){background:linear-gradient(90deg,#2a82d3,#31b6d4)}.funnel b{font-size:21px}.funnel h3{font-size:18px}.funnel p{font-size:14px;line-height:1.35}
.problem-improvement{display:grid;grid-template-columns:1fr 90px 1fr;gap:20px;align-items:center}.problem-column{height:410px;padding:20px;border:1px solid #d4dce6;border-radius:16px;background:#f7f8fa}.problem-column.improvement{border-color:#b7daf7;background:#f1f8ff}.problem-column>h3{padding:14px;border-radius:9px;background:#707984;color:#fff;font-size:22px;text-align:center}.problem-column.improvement>h3{background:#177cca}.problem-column>div{margin-top:12px;padding:12px 15px;border-radius:9px;background:#fff;box-shadow:0 4px 12px #283d5513}.problem-column b{color:#35485f;font-size:16px}.problem-column.improvement b{color:#176db4}.problem-column p{margin-top:5px;color:#6d7e90;font-size:14px}.improvement-arrow{width:70px;height:70px;display:grid;place-items:center;border-radius:50%;background:#18a9d2;color:#fff;font-size:34px;font-weight:900;box-shadow:0 8px 18px #1497be45}
`;

export function createVisualComponent(kind, id) {
  return Object.freeze({
    id,
    schemaVersion: 1,
    designFrame: { width: 1170, height: 492 },
    cssText: STRUCTURE_GROUP_REVIEW_CSS,
    renderMarkup(parameters) {
      return renderMarkup(kind, parameters);
    },
  });
}

export function clonePreviewParameters(parameters) {
  return structuredClone(parameters);
}
