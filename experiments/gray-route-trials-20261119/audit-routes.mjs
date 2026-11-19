import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright-core";

const directory = path.dirname(fileURLToPath(import.meta.url));
const executablePath = process.env.BROWSER_EXECUTABLE_PATH
  ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const lanes = ["template", "compose", "authored"];
const laneNames = { template: "A · 固定模板", compose: "B · 测量后组合", authored: "C · 模型自由编排" };
const caseNames = { options: "两种上线方案", services: "园区服务支持", hr: "不足与感悟", dense: "高密度原稿" };
const statusNames = { passed: "本轮通过", rejected: "已拒绝", partial: "部分通过" };
const signals = {
  options: {
    central: /集中上线/u,
    phased: /分批上线/u,
    sharedRollback: /回退演练/u,
    accountable: /责任人/u,
    restore: /数据恢复/u,
  },
  services: {
    equipment: /设备/u,
    room: /场地|会议室/u,
    information: /资料/u,
    visitors: /访客/u,
    commonDesk: /服务台/u,
    urgentCall: /紧急.{0,20}电话/u,
    restrictedAccess: /受限.{0,20}授权/u,
  },
  hr: {
    categoryIssues: /不足/u,
    categoryInsights: /感悟/u,
    inspectionYear: /2017/u,
    methodology: /BLM/iu,
    marketing: /三个市场化/u,
    onlyCriterion: /唯一/u,
    sustainedNotImmediate: /(?:不要求|无需|不求).{0,7}立竿见影.{0,15}(?:持续用力|持续努力)/u,
  },
};

async function inspect(page) {
  return page.evaluate(async () => {
    await document.fonts.ready;
    const entries = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const value = node.textContent.trim();
      const parent = node.parentElement;
      if (!value || parent.closest("script,style,template,noscript,title,desc")) continue;
      const ancestors = [];
      for (let element = parent; element; element = element.parentElement) {
        ancestors.push({ element, style: getComputedStyle(element) });
      }
      if (ancestors.some(({ style }) => style.display === "none" || style.visibility === "hidden" || +style.opacity === 0)) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const boxes = [...range.getClientRects()].filter((box) => box.width > 0 && box.height > 0);
      if (!boxes.length) continue;
      const clipped = ancestors.some(({ element, style }) => {
        const rect = element.getBoundingClientRect();
        const clipX = ["hidden", "clip"].includes(style.overflowX);
        const clipY = ["hidden", "clip"].includes(style.overflowY);
        return boxes.some((box) =>
          (clipX && (box.left < rect.left - 3 || box.right > rect.right + 3))
          || (clipY && (box.top < rect.top - 3 || box.bottom > rect.bottom + 3)));
      });
      const outside = boxes.some((box) =>
        box.left < -2 || box.top < -2 || box.right > innerWidth + 2 || box.bottom > innerHeight + 2);
      const marker = parent.closest("[data-source],[data-bind],[data-source-id]");
      entries.push({
        text: value,
        element: parent.tagName,
        sizePx: parseFloat(ancestors[0].style.fontSize),
        binding: marker?.dataset.bind ?? marker?.dataset.source ?? marker?.dataset.sourceId ?? null,
        role: parent.closest("[data-role]")?.dataset.role ?? null,
        clipped,
        outside,
      });
    }
    const contentFrame = document.querySelector("[data-content-frame]")?.getBoundingClientRect()?.toJSON() ?? null;
    return {
      entries,
      contentFrame,
      visibleSvgPathCount: [...document.querySelectorAll("svg path")]
        .filter((element) => element.getBoundingClientRect().width > 0 && getComputedStyle(element).visibility !== "hidden").length,
      imageCount: [...document.images].filter((element) => element.getBoundingClientRect().width > 0).length,
    };
  });
}

function escape(value) {
  return String(value).replace(/[&<>"]/gu, (character) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]);
}

function gallery(review) {
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>PPagenT 灰稿路线试错</title><style>
  *{box-sizing:border-box}body{margin:0;background:#f1f0ed;color:#272727;font:16px/1.6 "Microsoft YaHei",sans-serif}
  main{max-width:1750px;margin:auto;padding:24px 28px 35px}h1{font-size:30px;margin:0 0 5px}h2{font-size:20px;margin:18px 0 8px}
  nav{display:flex;gap:20px;flex-wrap:wrap}.row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
  article{padding:9px;background:#fff;border:1px solid #d5d4d0;min-width:0}.labels{display:flex;justify-content:space-between;gap:8px;margin:0 0 8px}
  .status{font-size:13px;color:#555}img{width:100%;height:auto;display:block;aspect-ratio:16/9;object-fit:contain;background:#fafafa}
  a{color:#264860} @media(max-width:670px){.row{grid-template-columns:1fr}main{padding:14px}}
  </style><body><main><h1>PPagenT 灰稿路线试错</h1>
  <nav><a href="README.md">综合结论</a><a href="independent-audit.json">独立抽查</a>
  <a href="bridge/README.md">换稿验证</a><a href="handoff/README.md">原生交接验证</a></nav>
  ${Object.entries(caseNames).map(([id, name]) => `<section><h2>${name}</h2><div class="row">${lanes.map((lane) => {
    const result = review.lanes[lane].find((row) => row.id === id);
    if (!result) return `<article>${laneNames[lane]} · 缺少本例回执</article>`;
    const preview = result.html ? escape(lane + "/" + result.html) : null;
    const png = result.png ? escape(lane + "/" + result.png) : null;
    return `<article><div class="labels"><strong>${laneNames[lane]}</strong><span class="status">${statusNames[result.status] ?? escape(result.status)}</span></div>
      ${png ? `<a href="${preview ?? png}"><img src="${png}" alt="${name}，${laneNames[lane]}"></a>` : ""}
      ${preview ? `<a href="${preview}">${result.status === "rejected" ? "打开失败预览" : "打开整页"}</a>`
        : `<a href="${lane}/results.json">查看拒绝记录</a>`}
    </article>`;
  }).join("")}</div></section>`).join("")}
  </main></body></html>`;
}

const browser = await chromium.launch({ executablePath, headless: true });
const review = { method: "Independent rendered-DOM sanity check; lexical anchors require human semantic review", lanes: {} };
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  for (const lane of lanes) {
    const laneDirectory = path.join(directory, lane);
    const results = JSON.parse(await fs.readFile(path.join(laneDirectory, "results.json"), "utf8"));
    review.lanes[lane] = [];
    for (const result of results.cases) {
      const { id, status } = result;
      const html = result.html ?? result.details?.diagnostic?.html;
      const png = result.png ?? result.details?.diagnostic?.png;
      const row = { id, status, html: html ?? null, png: png ?? null };
      if (html) {
        const htmlFile = path.resolve(laneDirectory, html);
        if (path.relative(laneDirectory, htmlFile).startsWith("..")) throw new Error("preview path escaped lane: " + html);
        const errors = [];
        const capture = (error) => errors.push(error.message);
        page.on("pageerror", capture);
        await page.goto(pathToFileURL(htmlFile).href);
        const measured = await inspect(page);
        page.off("pageerror", capture);
        const visible = measured.entries.filter((item) => !item.clipped && !item.outside)
          .map((item) => item.text).join(" ").replace(/\s+/gu, "");
        Object.assign(row, {
          domTextNodes: measured.entries.length,
          boundTextNodes: measured.entries.filter((item) => item.binding).length,
          outsideOrClipped: measured.entries.filter((item) => item.clipped || item.outside),
          flaggedBodyFont: measured.entries.filter((item) => ["body", "scope-note"].includes(item.role) && item.sizePx < 18),
          contentFrame: measured.contentFrame,
          svgPaths: measured.visibleSvgPathCount,
          images: measured.imageCount,
          pageErrors: errors,
          missingSignals: Object.entries(signals[id] ?? {})
            .filter(([, signal]) => !signal.test(visible)).map(([key]) => key),
        });
      }
      if (png) {
        const buffer = await fs.readFile(path.resolve(laneDirectory, png));
        if (buffer.subarray(1, 4).toString() !== "PNG" || buffer.readUInt32BE(16) !== 1280 || buffer.readUInt32BE(20) !== 720) {
          throw new Error("unexpected preview format or size: " + lane + "/" + png);
        }
      }
      if (status === "passed" && (!html || !png || !row.domTextNodes || row.pageErrors.length
        || row.outsideOrClipped.length || row.flaggedBodyFont.length || row.missingSignals.length)) {
        throw new Error("independent checks failed: " + lane + "/" + id);
      }
      review.lanes[lane].push(row);
    }
  }
  const galleryPath = path.join(directory, "index.html");
  await fs.writeFile(galleryPath, gallery(review), "utf8");
  await page.setViewportSize({ width: 1620, height: 1020 });
  await page.goto(pathToFileURL(galleryPath).href);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(directory, "overview.png"), fullPage: true });
} finally {
  await browser.close();
}
await fs.writeFile(path.join(directory, "independent-audit.json"), JSON.stringify(review, null, 2) + "\n", "utf8");
for (const [lane, rows] of Object.entries(review.lanes)) {
  console.log(lane);
  console.table(rows.map((row) => ({
    id: row.id, status: row.status, text: row.domTextNodes, bound: row.boundTextNodes,
    clipping: row.outsideOrClipped?.length, missingSignals: row.missingSignals?.join(", "),
  })));
}
