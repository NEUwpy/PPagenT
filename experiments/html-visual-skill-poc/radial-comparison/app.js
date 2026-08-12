const DATA = {
  4: {
    source: "./assets/source-p365.png",
    accepted: "./assets/accepted-r02.png",
    sourceLabel: "第 365 页 · 4 项",
    title: "Logo展示-不同类型合伙伙伴展示",
    items: [
      ["精准调控城市", "实时收集交通流量、能源消耗与环境质量"],
      ["畅享智慧交通", "出行不再是困扰，系统提供一站式服务"],
      ["服务百姓距离", "政务服务得到质的飞跃，减少繁琐流程"],
      ["培育创新人才", "智慧教育连接知识、人才与创新"],
    ],
  },
  6: {
    source: "./assets/source-p366.png",
    accepted: "./assets/accepted-r04.png",
    sourceLabel: "第 366 页 · 6 项",
    title: "Logo展示-不同类型合伙伙伴展示",
    items: [
      ["精准调控城市", "实时感知交通与环境状态"],
      ["畅享智慧交通", "一站式出行服务"],
      ["能源环境共生", "能源可持续利用"],
      ["培育创新人才", "安全与创新共同推进"],
      ["服务百姓距离", "公共服务更加便捷"],
      ["教育交流中心", "知识与人才持续流动"],
    ],
  },
  8: {
    source: "./assets/source-p367.png",
    accepted: "./assets/accepted-r06.png",
    sourceLabel: "第 367 页 · 8 项",
    title: "Logo展示-不同类型合伙伙伴展示",
    items: [
      ["精准调控城市", "实时感知城市运行状态"],
      ["畅享智慧交通", "构建一站式出行体验"],
      ["能源环境共生", "推动能源可持续利用"],
      ["培育创新人才", "加强安全与创新能力"],
      ["服务百姓距离", "让公共服务触手可及"],
      ["教育交流中心", "连接知识与人才"],
      ["疏通城市经络", "改善交通与人流循环"],
      ["驱动城市心脏", "以能源支撑智慧远见"],
    ],
  },
};

let count = 4;
const sourceImage = document.querySelector("#source-image");
const sourceLabel = document.querySelector("#source-label");

function svgLines(points, center, className = "connector-layer") {
  return `<svg class="${className}" viewBox="0 0 1000 500" preserveAspectRatio="none" aria-hidden="true">
    ${points.map((point) => `<line x1="${center.x}" y1="${center.y}" x2="${point.x}" y2="${point.y}" stroke="#b8d0e5" stroke-width="1.4" vector-effect="non-scaling-stroke" />`).join("")}
  </svg>`;
}

function sidePositions(itemCount, top = 18, bottom = 82) {
  const pairCount = itemCount / 2;
  return Array.from({ length: itemCount }, (_, index) => {
    const row = Math.floor(index / 2);
    const side = index % 2 === 0 ? "left" : "right";
    return {
      side,
      x: side === "left" ? 17 : 83,
      y: pairCount === 1 ? 50 : top + ((bottom - top) * row) / (pairCount - 1),
    };
  });
}

function renderFaithful(data) {
  const positions = sidePositions(data.items.length, data.items.length >= 8 ? 13 : 22, data.items.length >= 8 ? 87 : 78);
  const linePoints = positions.map((p) => ({ x: p.x * 10, y: p.y * 5 }));
  document.querySelector("#faithful-root").innerHTML = `
    <div class="ppt-stage">
      <div class="ppt-title">${data.title}</div><div class="ppt-brand">旁门左道PPT</div>
      <div class="radial-canvas">
        ${svgLines(linePoints, { x: 500, y: 250 })}
        <div class="source-halo"></div>
        <div class="source-center"><img src="./assets/mountain.jpeg" alt="雪山中央视觉" /></div>
        ${data.items.map((item, index) => {
          const p = positions[index];
          return `<div class="source-item ${p.side}" style="top:${p.y}%">
            ${p.side === "left" ? `<div class="logo">${String(index + 1).padStart(2,"0")}</div>` : ""}
            <div class="copy"><h4>${item[0]}</h4><p>${item[1]}</p></div>
            ${p.side === "right" ? `<div class="logo">${String(index + 1).padStart(2,"0")}</div>` : ""}
          </div>`;
        }).join("")}
      </div>
    </div>`;
}

function renderAccepted(data) {
  const positions = sidePositions(data.items.length, data.items.length >= 8 ? 10 : 18, data.items.length >= 8 ? 90 : 82);
  const linePoints = positions.map((p) => ({ x: p.x * 10, y: p.y * 5 }));
  document.querySelector("#accepted-root").innerHTML = `
    <div class="asset-stage">
      <div class="skin-top"><b>0${Math.min(data.items.length,9)}　中心辐射</b><span>东北大学　NORTHEASTERN UNIVERSITY</span></div>
      <div class="blue-rail">多向支撑</div><div class="bottom-rail"></div>
      <div class="asset-radial">
        ${svgLines(linePoints, { x: 500, y: 260 })}
        <div class="asset-center">统一内核</div>
        ${data.items.map((item,index) => {
          const p = positions[index];
          return `<div class="asset-item ${p.side}" style="top:${p.y}%">
            <div class="node">${String(index+1).padStart(2,"0")}</div>
            <h4>${item[0]}</h4><p>${item[1]}</p>
          </div>`;
        }).join("")}
      </div>
    </div>`;
}

function explorerPositions(itemCount) {
  const pairCount = itemCount / 2;
  return Array.from({ length: itemCount }, (_, index) => {
    const row = Math.floor(index / 2);
    const side = index % 2 === 0 ? "left" : "right";
    return { side, x: side === "left" ? 23 : 77, y: pairCount === 1 ? 52 : 22 + (60 * row) / (pairCount - 1) };
  });
}

function renderExplorer(data) {
  const positions = explorerPositions(data.items.length);
  document.querySelector("#explorer-root").innerHTML = `
    <div class="explore-stage">
      <div class="explore-title"><b>一套数据，自动完成对称扩散</b><span>数量变化只改变布局参数，不改组件结构</span></div>
      <svg class="explore-lines" viewBox="0 0 1000 520" preserveAspectRatio="none" aria-hidden="true">
        ${positions.map((p) => `<path d="M500 270 C${p.side === "left" ? 410 : 590} 270, ${p.side === "left" ? 390 : 610} ${p.y * 5.2}, ${p.x * 10} ${p.y * 5.2}" fill="none" stroke="#83b8d4" stroke-width="1.5" vector-effect="non-scaling-stroke" />`).join("")}
      </svg>
      <div class="explore-center"><b>城市能力<br/>操作系统</b></div>
      ${data.items.map((item,index) => {
        const p = positions[index];
        return `<div class="orbit-node ${p.side === "left" ? "on-left" : ""}" style="left:${p.x}%;top:${p.y}%">
          <div class="orbit-index">${String(index+1).padStart(2,"0")}</div>
          <div><h4>${item[0]}</h4><p>${item[1]}</p></div>
        </div>`;
      }).join("")}
    </div>`;
}

function render() {
  const data = DATA[count];
  sourceImage.src = data.source;
  document.querySelector("#accepted-image").src = data.accepted;
  sourceImage.alt = `原模板${data.sourceLabel}截图`;
  sourceLabel.textContent = data.sourceLabel;
  document.querySelectorAll("[data-count]").forEach((button) => button.classList.toggle("active", Number(button.dataset.count) === count));
  renderFaithful(data);
  renderAccepted(data);
  renderExplorer(data);
}

document.querySelectorAll("[data-count]").forEach((button) => button.addEventListener("click", () => {
  count = Number(button.dataset.count);
  render();
}));

render();
