const items = [
  { icon: "./assets/icon-left-top.png", title: "精准调控城市", body: "实时收集交通流量、能源消耗与环境质量" },
  { icon: "./assets/icon-right-top.png", title: "畅享智慧交通", body: "在智慧城市中，出行不再是困扰，系统提供一站式服务" },
  { icon: "./assets/icon-left-bottom.png", title: "服务百姓距离", body: "政务服务得到质的飞跃，减少繁琐流程" },
  { icon: "./assets/icon-right-bottom.png", title: "培育创新人才", body: "教育连接知识、人才与创新" },
  { mark: "EN", title: "能源环境共生", body: "推动能源可持续利用和环境友好保护" },
  { mark: "ED", title: "教育交流中心", body: "连接知识、人才与创新，让能力持续流动" },
  { mark: "CT", title: "疏通城市经络", body: "改善交通与人流循环，让城市运行更顺畅" },
];

const centerVisual = {
  src: "./assets/center-mountain.jpg",
  alt: "中心雪山视觉锚点",
};

let currentCount = 4;
let currentPreset = "wide";
const frame = document.querySelector("#content-frame");
const componentHost = document.querySelector("#radial-component");
const metrics = document.querySelector("#bench-metrics");
const instance = mountRadialStructure(componentHost, { items, centerVisual, count: currentCount });

function renderMetrics() {
  requestAnimationFrame(() => {
    const state = instance.getState();
    metrics.textContent = `${state.width} × ${state.height}px · ${state.count} 项 · ${state.leftCount}/${state.rightCount} · ${state.density}`;
  });
}

function updateCount(count) {
  currentCount = count;
  instance.update({ count: currentCount });
  document.querySelectorAll("button[data-count]").forEach((button) => button.classList.toggle("active", Number(button.dataset.count) === currentCount));
  renderMetrics();
}

function updatePreset(preset) {
  currentPreset = preset;
  frame.dataset.preset = preset;
  document.querySelectorAll("button[data-preset]").forEach((button) => button.classList.toggle("active", button.dataset.preset === currentPreset));
  requestAnimationFrame(renderMetrics);
}

document.querySelectorAll("button[data-count]").forEach((button) => button.addEventListener("click", () => updateCount(Number(button.dataset.count))));
document.querySelectorAll("button[data-preset]").forEach((button) => button.addEventListener("click", () => updatePreset(button.dataset.preset)));
new ResizeObserver(renderMetrics).observe(frame);
updatePreset(currentPreset);
renderMetrics();
