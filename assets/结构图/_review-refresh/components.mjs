import { htmlTextFlowCss, textFlowMarkup } from "../../../src/visual-runtime/text-flow.mjs";

const FRAME = Object.freeze({ width: 1170, height: 492 });
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
})[character]);
const clone = (value) => structuredClone(value);
const list = (value, min, max, field) => {
  if (!Array.isArray(value) || value.length < min || value.length > max) {
    throw new Error(`${field} 需要 ${min}–${max} 项`);
  }
  return value;
};
const txt = (value, max = 42, field = "文本") => {
  const result = String(value ?? "").trim();
  if (!result || [...result].length > max) throw new Error(`${field} 超出容量`);
  return result;
};
const flow = (field, value, options = {}) => {
  const object = typeof value === "object" && value !== null ? value : { title: value };
  return textFlowMarkup({
    id: options.id ?? field.replace(/[^a-zA-Z0-9-]/g, "-") ,
    field,
    itemId: options.itemId ?? "",
    regionId: options.regionId ?? "main",
    title: object.title ?? "",
    body: object.body ?? "",
    points: object.points ?? [],
    className: options.className ?? "",
    align: options.align ?? "left",
    valign: options.valign ?? "middle",
    tone: options.tone ?? "light",
    separator: options.separator ?? false,
    required: options.required ?? true,
  });
};
const scalar = (field, value, className = "") => `<span class="${className}" data-slot-id="${esc(field)}" data-slot-role="label" data-slot-field="${esc(field)}" data-slot-content-type="text">${esc(value)}</span>`;

const CSS = `
${htmlTextFlowCss()}
*{box-sizing:border-box}
.rev{position:relative;width:1170px;height:492px;overflow:hidden;color:#284f70;font-family:var(--ppagent-font-body,"Microsoft YaHei"),sans-serif;--navy:#285b84;--blue:#4f84aa;--sky:#9bbbd0;--pale:#eaf2f7;--ink:#284f70;--muted:#65798a;--peach:#c98258;--peach-pale:#f5e9e1;--line:#b7cbd8;--paper:#fff}
.rev svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.rev .ppagent-text-flow__title{font-size:var(--title-size,17pt);font-weight:700;line-height:1.22;color:var(--title-color,var(--ink))}
.rev .ppagent-text-flow__body{font-size:var(--body-size,12.5pt);line-height:1.42;color:var(--body-color,var(--muted));white-space:pre-line}
.rev .tone-dark{--title-color:#fff;--body-color:#dce9f2}
.rev .paper{background:#fff;border:1px solid #d8e4ec;box-shadow:0 9px 22px rgba(33,72,103,.10)}
.rev .soft-shadow{box-shadow:0 12px 28px rgba(34,74,105,.14)}

/* fixed four-stage improvement cycle */
.rev-pdca .cycle-card{position:absolute;width:300px;height:126px;padding:19px 22px;border-radius:18px;background:#fff;border:1px solid #d7e4ec;box-shadow:0 8px 20px rgba(36,72,102,.09)}
.rev-pdca .cycle-card:nth-of-type(1){left:32px;top:20px}.rev-pdca .cycle-card:nth-of-type(2){right:32px;top:20px}.rev-pdca .cycle-card:nth-of-type(3){right:32px;bottom:20px}.rev-pdca .cycle-card:nth-of-type(4){left:32px;bottom:20px}
.rev-pdca .cycle-card{--title-size:17pt;--body-size:12pt}.rev-pdca .phase-code{position:absolute;top:14px;right:16px;font-size:26pt;font-weight:800;color:#d9e7f0}
.rev-pdca .cycle-card:nth-of-type(2) .phase-code,.rev-pdca .cycle-card:nth-of-type(4) .phase-code{color:#efdace}
.rev-pdca .core{position:absolute;left:491px;top:178px;width:188px;height:136px;padding:20px 24px;border-radius:50%;background:radial-gradient(circle at 35% 28%,#467da4 0,#285b84 58%,#1f496c 100%);border:9px solid #e0ecf3;display:grid;place-items:center;text-align:center;--title-size:18pt}

/* work breakdown with ribbon branches */
.rev-wbs .wbs-root{position:absolute;left:18px;top:152px;width:220px;height:188px;padding:26px;border-radius:28px;background:linear-gradient(145deg,#376f98,#244f75);display:grid;place-items:center;text-align:center;--title-size:20pt}
.rev-wbs .wbs-lanes{position:absolute;left:300px;right:18px;top:18px;bottom:18px;display:grid;gap:12px}
.rev-wbs .wbs-lane{position:relative;display:grid;grid-template-columns:230px 1fr;gap:22px;align-items:center;min-height:0}
.rev-wbs .package{position:relative;height:78px;padding:18px 30px 18px 26px;background:linear-gradient(90deg,#3f789f,#6e9dbb);clip-path:polygon(0 0,91% 0,100% 50%,91% 100%,0 100%,7% 50%);border-left:8px solid #fff;display:grid;place-items:center;text-align:center;--title-size:15.5pt}
.rev-wbs .tasks{display:flex;gap:8px;align-items:center;min-width:0}
.rev-wbs .task{flex:1;min-width:0;height:54px;padding:8px 10px;border-radius:12px;background:#eef3f6;border:1px solid #dbe5eb;display:grid;place-items:center;text-align:center;font-size:11.5pt;color:#496174}

/* restrained orbit ecology */
.rev-twohub .planet-core{position:absolute;left:470px;top:159px;width:230px;height:174px;padding:28px;border-radius:50%;background:radial-gradient(circle at 34% 27%,#5d8eae 0,#2f6288 54%,#244c70 100%);border:10px solid rgba(226,238,246,.96);display:grid;place-items:center;text-align:center;--title-size:18pt}
.rev-twohub .orbit-node{position:absolute;transform:translate(-50%,-50%);padding:10px 15px;border-radius:16px;background:#fff;border:1px solid #d6e3eb;box-shadow:0 6px 16px rgba(35,73,103,.09);text-align:center;font-size:11.5pt;color:#355873;white-space:nowrap}
.rev-twohub .orbit-node.inner{background:#e7f0f5;border-color:#a7c1d2;font-weight:700;font-size:12pt}.rev-twohub .orbit-node.outer{border-color:#e1c1ad}

/* one driver to outcomes */
.rev-directed .driver{position:absolute;left:425px;top:90px;width:320px;height:312px;padding:60px;border-radius:50%;background:radial-gradient(circle at 35% 28%,#5688aa 0,#285b84 58%,#1d4567 100%);border:18px solid #e2edf4;box-shadow:0 20px 32px rgba(35,76,108,.18);display:grid;place-items:center;text-align:center;--title-size:20pt;--body-size:12.5pt}
.rev-directed .outcome{position:absolute;width:260px;height:86px;padding:14px 18px;border-radius:15px;background:#fff;border:1px solid #d9e5ed;box-shadow:0 7px 17px rgba(36,72,102,.09);--title-size:14.5pt;--body-size:10.5pt}

/* primary item with symmetric peers */
.rev-featured .feature-rail{position:absolute;left:30px;top:35px;width:310px;height:422px;border-radius:28px;background:linear-gradient(160deg,#376f98,#244f75);padding:60px 42px;display:grid;place-items:center;text-align:center;--title-size:23pt;--body-size:13pt}
.rev-featured .feature-rail:after{content:"";position:absolute;right:-23px;top:174px;border-left:24px solid #315f87;border-top:37px solid transparent;border-bottom:37px solid transparent}
.rev-featured .peer-grid{position:absolute;left:405px;right:28px;top:28px;bottom:28px;display:grid;grid-template-columns:repeat(2,1fr);gap:16px}
.rev-featured .peer{position:relative;padding:26px 28px 22px 36px;border-radius:19px;background:#fff;border:1px solid #d8e4ec;box-shadow:0 8px 18px rgba(36,72,102,.08);--title-size:16pt;--body-size:11.5pt}.rev-featured .peer:before{content:"";position:absolute;left:0;top:20px;bottom:20px;width:7px;border-radius:0 7px 7px 0;background:#7fa8c3}.rev-featured .peer:nth-child(2n):before{background:#cf9270}

/* grouped peers with distinct theme bays */
.rev-clusters{display:grid;grid-template-columns:repeat(var(--groups),1fr);gap:18px;padding:24px}
.rev-clusters .cluster{position:relative;padding:82px 18px 18px;border-radius:22px;background:linear-gradient(180deg,#edf4f8,#f8fafc);border:1px solid #d9e5ed;min-width:0}
.rev-clusters .cluster-head{position:absolute;left:14px;right:14px;top:14px;height:54px;padding:10px 20px;background:linear-gradient(90deg,#356b93,#6796b5);color:#fff;clip-path:polygon(0 0,94% 0,100% 50%,94% 100%,0 100%,6% 50%);display:grid;place-items:center;text-align:center;--title-size:15pt}
.rev-clusters .cluster-items{height:100%;display:grid;gap:10px}.rev-clusters .cluster-item{padding:14px 16px;border-radius:13px;background:#fff;border:1px solid #dce6ed;box-shadow:0 5px 12px rgba(35,72,102,.06);--title-size:14pt;--body-size:10.8pt}

/* matrices */
.rev-risk{display:grid;grid-template-columns:128px repeat(3,1fr);grid-template-rows:58px repeat(3,1fr);gap:7px;padding:18px 22px 26px 32px}
.rev-risk .m-head{display:grid;place-items:center;border-radius:10px;background:#315f87;color:#fff;font-weight:700}.rev-risk .m-axis{display:grid;place-items:center;border-radius:10px;background:#e5eef4;color:#355a77;font-weight:700}.rev-risk .m-cell{position:relative;border-radius:12px;background:#e7f0f4;padding:10px;display:flex;align-content:center;justify-content:center;align-items:center;flex-wrap:wrap;gap:6px}.rev-risk .m-cell.mid{background:#f1e8dc}.rev-risk .m-cell.high{background:#dca783}.rev-risk .chip{padding:6px 9px;border-radius:12px;background:#fff;border:1px solid rgba(47,92,126,.15);font-size:10.5pt;color:#315776;box-shadow:0 3px 8px rgba(35,70,100,.06)}
.rev-scatter .plot{position:absolute;left:28px;top:12px;width:520px;height:462px}.rev-scatter .point{position:absolute;transform:translate(-50%,-50%);width:42px;height:42px;border:4px solid #fff;border-radius:50%;background:var(--point);color:#fff;display:grid;place-items:center;font-weight:700;box-shadow:0 4px 10px rgba(35,72,102,.15)}
.rev-scatter .legend{position:absolute;left:585px;right:24px;top:18px;bottom:18px;display:grid;grid-template-columns:repeat(2,1fr);gap:6px 18px}.rev-scatter .legend-row{position:relative;padding:11px 8px 9px 50px;border-bottom:1px solid #dce6ed;--title-size:13.5pt;--body-size:10.5pt}.rev-scatter .legend-index{position:absolute;left:8px;top:15px;width:30px;height:30px;border-radius:50%;background:var(--point);color:#fff;display:grid;place-items:center;font-weight:700}
.rev-raci{padding:14px 22px}.rev-raci .matrix{height:416px;display:grid;grid-template-columns:238px repeat(var(--roles),1fr);grid-template-rows:64px repeat(var(--tasks),1fr);gap:7px}.rev-raci .cell{display:grid;place-items:center;border-radius:10px;background:#f1f5f8;text-align:center;padding:8px}.rev-raci .head{background:#315f87;color:#fff;font-weight:700}.rev-raci .task{justify-items:start;padding-left:20px;background:#e6eef4;color:#315978;font-weight:700}.rev-raci .code{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;background:#fff;border:2px solid #dbe5ec;color:#a2afb9;font-weight:800}.rev-raci .code.R{background:#315f87;border-color:#315f87;color:#fff}.rev-raci .code.A{background:#c17a50;border-color:#c17a50;color:#fff}.rev-raci .code.C{background:#7ca5bf;border-color:#7ca5bf;color:#fff}.rev-raci .code.I{background:#aab8c2;border-color:#aab8c2;color:#fff}.rev-raci .legend{height:48px;display:flex;gap:18px;justify-content:flex-end;align-items:center;color:#687b8a;font-size:11.5pt}

/* zigzag strategy cards */
.rev-zigzag{display:flex;align-items:center;padding:38px 26px;gap:12px}.rev-zigzag .step{position:relative;flex:1;height:330px;padding:104px 22px 25px;border-radius:18px;background:linear-gradient(180deg,#fff,#f8fafc);border:1px solid #d8e4ec;box-shadow:0 10px 22px rgba(34,72,103,.09);--title-size:16pt;--body-size:11.5pt}.rev-zigzag .step:nth-child(even){transform:translateY(28px)}.rev-zigzag .step:nth-child(odd){transform:translateY(-22px)}.rev-zigzag .step:after{content:attr(data-order);position:absolute;right:18px;bottom:8px;color:#e2ebf1;font-size:54pt;font-weight:800;line-height:1;z-index:0}.rev-zigzag .step>.ppagent-text-flow{position:relative;z-index:1}.rev-zigzag .step:before{content:"";position:absolute;left:22px;bottom:24px;width:42px;height:5px;border-radius:4px;background:#7ea5bf}.rev-zigzag .step:nth-child(even):before{background:#ca8862}
.rev-zigzag .angled{position:absolute;left:-8px;right:15px;top:25px;height:55px;padding:12px 20px;background:#315f87;color:#fff;clip-path:polygon(0 0,93% 0,100% 50%,93% 100%,0 100%,7% 50%);font-size:12pt;font-weight:700}.rev-zigzag .step:nth-child(even) .angled{background:#c17a50}.rev-zigzag .connector{font-size:24pt;color:#9ab3c3}

/* actual balance */
.rev-balance .beam{position:absolute;left:180px;right:180px;top:182px;height:12px;border-radius:8px;background:#315f87;transform:rotate(var(--tilt,0deg));transform-origin:center}.rev-balance .pivot{position:absolute;left:520px;top:184px;width:130px;height:208px;background:linear-gradient(180deg,#5f8eac,#2d5c82);clip-path:polygon(45% 0,55% 0,100% 100%,0 100%)}
.rev-balance .topic{position:absolute;left:425px;top:16px;width:320px;height:105px;padding:16px 24px;border-radius:22px;background:#fff;border:1px solid #d8e4ec;box-shadow:0 8px 18px rgba(35,72,103,.08);text-align:center;--title-size:17pt;--body-size:11pt}.rev-balance .pan{position:absolute;top:238px;width:420px;min-height:210px;padding:42px 26px 20px;border-radius:0 0 160px 160px;background:#e7f0f5;border-bottom:8px solid #6f9bb8}.rev-balance .pan.left{left:40px}.rev-balance .pan.right{right:40px;background:#f4ebe5;border-bottom-color:#c38662}.rev-balance .pan h3{margin:0 0 12px;text-align:center;font-size:17pt}.rev-balance .pan ul{margin:0;padding-left:24px;color:#526879;font-size:12pt;line-height:1.55}.rev-balance .verdict{position:absolute;left:410px;bottom:18px;width:350px;height:72px;padding:10px 18px;border-radius:18px;background:#315f87;display:grid;place-items:center;text-align:center;--title-size:13pt}

/* restrained generative iceberg: one silhouette, faceted with a quiet blue scale */
.rev-iceberg{background:linear-gradient(180deg,#fff 0 35.5%,#f3f7fa 35.5% 100%)}
.rev-iceberg .iceberg-art{position:absolute;inset:0;width:1170px;height:492px}
.rev-iceberg .waterline{stroke:#9ab8ca;stroke-width:2.5}
.rev-iceberg .water-glint{stroke:#d9e7ef;stroke-width:1.5;opacity:.9}
.rev-iceberg .berg-piece{stroke:#fff;stroke-width:4;stroke-linejoin:round}
.rev-iceberg .visible-label,.rev-iceberg .hidden-label{position:absolute;display:grid;place-items:center;text-align:center;overflow:hidden;--title-size:15pt}
.rev-iceberg .visible-label{padding:2px 5px;color:#315c7b;--title-color:#315c7b}
.rev-iceberg .visible-label>.ppagent-text-flow{width:100%;height:100%}
.rev-iceberg .hidden-label{padding:8px 30px;--title-color:#315a76}
.rev-iceberg .hidden-label.tone-deep{--title-color:#fff}

/* architecture rather than generic table */
.rev-domain{padding:22px 30px 20px 158px}.rev-domain .domain-columns{position:absolute;left:158px;right:30px;top:20px;height:54px;display:grid;grid-template-columns:repeat(var(--domains),1fr);gap:10px}.rev-domain .domain-label{display:grid;place-items:center;border-radius:16px 16px 6px 6px;background:#315f87;color:#fff;font-weight:700}.rev-domain .layers{position:absolute;left:158px;right:30px;top:84px;bottom:20px;display:grid;gap:9px}.rev-domain .layer{position:relative;display:grid;grid-template-columns:repeat(var(--domains),1fr);gap:10px;padding:8px;border-radius:14px;background:linear-gradient(90deg,#e1edf4,#f7fafc);border-left:8px solid var(--layer-color,#5d8dab)}.rev-domain .layer-name{position:absolute;right:calc(100% + 18px);top:50%;transform:translateY(-50%);width:110px;text-align:right;font-weight:700;color:#315978}.rev-domain .capability{display:grid;place-items:center;padding:7px 10px;border-radius:10px;background:rgba(255,255,255,.86);border:1px solid #dbe6ed;text-align:center;font-size:11.5pt;color:#4c6274}

/* tapered authority bands */
.rev-authority{padding:18px 100px}.rev-authority .authority-stack{height:100%;display:grid;gap:9px}.rev-authority .authority-band{position:relative;margin:auto;height:100%;width:var(--band-width);padding:10px 32px 10px 170px;background:linear-gradient(90deg,var(--band-color),#f7fafc 34%);clip-path:polygon(5% 0,95% 0,100% 50%,95% 100%,5% 100%,0 50%);display:flex;align-items:center;gap:9px}.rev-authority .authority-name{position:absolute;left:30px;width:120px;color:#fff;font-weight:700;text-align:center}.rev-authority .role-pill{flex:1;min-width:0;padding:9px 10px;border-radius:12px;background:#fff;border:1px solid #d8e4ec;text-align:center;font-size:11.5pt;color:#496174}

/* layered stack crossed by translucent rails */
.rev-crosscut{padding:22px 236px 22px 34px}.rev-crosscut .layer-stack{height:100%;display:grid;gap:10px}.rev-crosscut .layer-bar{position:relative;padding:12px 25px;border-radius:14px;background:linear-gradient(90deg,#315f87 0 22%,#e9f2f7 22%);border:1px solid #d4e2eb;--title-size:14.5pt;--body-size:10.8pt}.rev-crosscut .layer-bar .ppagent-text-flow{padding-left:210px}.rev-crosscut .layer-title-fixed{position:absolute;left:22px;top:50%;transform:translateY(-50%);width:190px;color:#fff;font-weight:700}.rev-crosscut .rail-zone{position:absolute;right:32px;top:22px;bottom:22px;width:170px;display:grid;grid-template-columns:repeat(var(--rails),1fr);gap:14px}.rev-crosscut .rail{display:grid;place-items:center;padding:14px 8px;border-radius:28px;background:linear-gradient(180deg,rgba(115,160,188,.95),rgba(43,91,128,.96));color:#fff;font-weight:700;writing-mode:vertical-rl;letter-spacing:2px;box-shadow:0 8px 18px rgba(34,72,103,.12)}

/* branch and rejoin without heavy endpoint blocks */
.rev-rejoin .endpoint{position:absolute;top:153px;width:190px;height:186px;padding:28px 24px;border-radius:50%;background:radial-gradient(circle at 35% 25%,#5588aa,#285b84 62%);border:10px solid #e2edf4;display:grid;place-items:center;text-align:center;--title-size:15pt}.rev-rejoin .endpoint.start{left:10px}.rev-rejoin .endpoint.result{right:10px;background:radial-gradient(circle at 35% 25%,#d39a79,#ad6844 68%);border-color:#f3e7df}.rev-rejoin .routes{position:absolute;left:270px;right:270px;top:15px;bottom:15px;display:grid;gap:10px}.rev-rejoin .route{position:relative;padding:13px 35px 13px 88px;border-radius:16px;background:#fff;border:1px solid #d8e4ec;box-shadow:0 6px 15px rgba(35,72,102,.07);--title-size:14pt;--body-size:10.5pt}.rev-rejoin .route-no{position:absolute;left:20px;top:50%;transform:translateY(-50%);width:44px;height:44px;border-radius:50%;display:grid;place-items:center;background:#7ba4bf;color:#fff;font-weight:700}

/* staged convergence */
.rev-merge .merge-inputs{position:absolute;left:20px;top:18px;bottom:18px;width:260px;display:grid;gap:8px}.rev-merge .merge-input-node{position:relative;padding:8px 14px 8px 20px;border-radius:11px;background:#eef4f7;border-left:6px solid #6d9ab7;display:grid;place-items:center;text-align:center;font-size:11pt;color:#496174}.rev-merge .merge-themes{position:absolute;left:455px;top:68px;bottom:68px;width:270px;display:grid;gap:18px}.rev-merge .merge-theme-node{position:relative;padding:16px 22px;background:linear-gradient(90deg,#5b8eae,#3c6f94);clip-path:polygon(0 0,90% 0,100% 50%,90% 100%,0 100%,8% 50%);display:grid;place-items:center;text-align:center;--title-size:14pt}.rev-merge .merge-result-node{position:absolute;right:24px;top:142px;width:242px;height:208px;padding:34px;border-radius:50%;background:radial-gradient(circle at 35% 27%,#5889aa,#285b84 64%);border:12px solid #e2edf4;display:grid;place-items:center;text-align:center;--title-size:16pt}
`;

function orbitPoint(index, count, rx, ry) {
  const angle = -Math.PI / 2 + index * Math.PI * 2 / count;
  return { x: 585 + Math.cos(angle) * rx, y: 246 + Math.sin(angle) * ry };
}

function renderPdca(p) {
  const steps = list(p.steps, 4, 4, "steps");
  const arcs = [
    "M585 95 A151 151 0 0 1 736 246", "M736 246 A151 151 0 0 1 585 397",
    "M585 397 A151 151 0 0 1 434 246", "M434 246 A151 151 0 0 1 585 95",
  ];
  return `<section class="rev rev-pdca" data-ppt-root><svg viewBox="0 0 1170 492"><defs><marker id="pdca-arrow" markerWidth="4.2" markerHeight="4.2" refX="3.2" refY="2.1" orient="auto"><path d="M0 0 L4.2 2.1 L0 4.2 Z" fill="#4f84aa"/></marker></defs>${arcs.map((d, i) => `<path d="${d}" fill="none" stroke="${i % 2 ? "#c98258" : "#4f84aa"}" stroke-width="17" stroke-linecap="round" marker-end="url(#pdca-arrow)"/>`).join("")}</svg>${steps.map((step, i) => `<article class="cycle-card"><span class="phase-code">${esc(step.code)}</span>${flow(`steps[${i}]`, step, { id: `pdca-step-${i}`, itemId: `step-${i}` })}</article>`).join("")}<div class="core tone-dark">${flow("center", { title: p.center }, { id: "pdca-center", align: "center", tone: "dark" })}</div></section>`;
}

function renderWbs(p) {
  const packages = list(p.packages, 2, 4, "packages");
  return `<section class="rev rev-wbs" data-ppt-root><svg viewBox="0 0 1170 492">${packages.map((_, i) => { const y = 55 + i * (382 / Math.max(1, packages.length - 1)); return `<path d="M238 246 C270 246 268 ${y} 300 ${y}" fill="none" stroke="#9bb5c5" stroke-width="4"/>`; }).join("")}</svg><div class="wbs-root tone-dark">${flow("root", { title: p.root }, { id: "wbs-root", align: "center", tone: "dark" })}</div><div class="wbs-lanes" style="grid-template-rows:repeat(${packages.length},1fr)">${packages.map((pkg, i) => `<section class="wbs-lane"><div class="package tone-dark">${flow(`packages[${i}].title`, { title: pkg.title }, { id: `wbs-package-${i}`, align: "center", tone: "dark" })}</div><div class="tasks">${list(pkg.tasks, 1, 4, `packages[${i}].tasks`).map((task, j) => `<div class="task">${scalar(`packages[${i}].tasks[${j}]`, task)}</div>`).join("")}</div></section>`).join("")}</div></section>`;
}

function renderTwoHub(p) {
  const inner = list(p.inner, 3, 4, "inner"); const outer = list(p.outer, 4, 8, "outer");
  const rings = `<svg viewBox="0 0 1170 492"><ellipse cx="585" cy="246" rx="270" ry="128" fill="none" stroke="#8fb0c4" stroke-width="3"/><ellipse cx="585" cy="246" rx="470" ry="210" fill="none" stroke="#d8b9a6" stroke-width="2" stroke-dasharray="7 7"/>${inner.map((_, i) => { const q = orbitPoint(i, inner.length, 270, 128); return `<line x1="585" y1="246" x2="${q.x}" y2="${q.y}" stroke="#b8ccd8" stroke-width="2"/>`; }).join("")}</svg>`;
  return `<section class="rev rev-twohub" data-ppt-root>${rings}<div class="planet-core tone-dark">${flow("center", { title: p.center }, { id: "twohub-center", align: "center", tone: "dark" })}</div>${inner.map((value, i) => { const q = orbitPoint(i, inner.length, 270, 128); return `<div class="orbit-node inner" style="left:${q.x}px;top:${q.y}px">${scalar(`inner[${i}]`, value)}</div>`; }).join("")}${outer.map((value, i) => { const q = orbitPoint(i, outer.length, 470, 210); return `<div class="orbit-node outer" style="left:${q.x}px;top:${q.y}px">${scalar(`outer[${i}]`, value)}</div>`; }).join("")}</section>`;
}

function renderDirected(p) {
  const items = list(p.items, 4, 6, "items");
  const positions = items.length <= 4 ? [[150,70],[1020,70],[1020,365],[150,365]] : [[150,55],[1010,55],[1030,246],[1010,390],[150,390],[140,246]];
  const lines = items.map((_, i) => `<line x1="585" y1="246" x2="${positions[i][0]}" y2="${positions[i][1]}" stroke="#8faec1" stroke-width="3"/>`).join("");
  return `<section class="rev rev-directed" data-ppt-root><svg viewBox="0 0 1170 492">${lines}</svg><div class="driver tone-dark">${flow("center", p.center, { id: "directed-center", align: "center", tone: "dark" })}</div>${items.map((item, i) => `<article class="outcome" style="left:${positions[i][0] < 585 ? positions[i][0] - 130 : positions[i][0] - 130}px;top:${positions[i][1] - 43}px">${flow(`items[${i}]`, item, { id: `directed-item-${i}`, itemId: item.key ?? `item-${i}`, valign: "middle" })}</article>`).join("")}</section>`;
}

function renderFeatured(p) {
  const peers = list(p.peers, 2, 5, "peers");
  return `<section class="rev rev-featured" data-ppt-root><div class="feature-rail tone-dark">${flow("lead", p.lead, { id: "feature-lead", align: "center", tone: "dark" })}</div><div class="peer-grid">${peers.map((peer, i) => `<article class="peer">${flow(`peers[${i}]`, peer, { id: `feature-peer-${i}`, itemId: `peer-${i}` })}</article>`).join("")}</div></section>`;
}

function renderClusters(p) {
  const groups = list(p.groups, 2, 3, "groups");
  return `<section class="rev rev-clusters" data-ppt-root style="--groups:${groups.length}">${groups.map((group, i) => `<section class="cluster"><div class="cluster-head tone-dark">${flow(`groups[${i}].title`, { title: group.title }, { id: `cluster-title-${i}`, align: "center", tone: "dark" })}</div><div class="cluster-items">${list(group.items, 2, 3, `groups[${i}].items`).map((item, j) => `<article class="cluster-item">${flow(`groups[${i}].items[${j}]`, item, { id: `cluster-item-${i}-${j}`, itemId: `group-${i}-item-${j}` })}</article>`).join("")}</div></section>`).join("")}</section>`;
}

function renderRisk(p) {
  const objects = list(p.objects, 4, 9, "objects");
  const cells = [];
  for (let impact = 3; impact >= 1; impact -= 1) for (let likelihood = 1; likelihood <= 3; likelihood += 1) {
    const members = objects.filter((item) => Number(item.impact) === impact && Number(item.likelihood) === likelihood);
    const className = impact + likelihood >= 5 ? "high" : impact + likelihood >= 4 ? "mid" : "";
    cells.push(`<div class="m-cell ${className}">${members.map((item) => `<span class="chip">${esc(item.name)}</span>`).join("")}</div>`);
  }
  return `<section class="rev rev-risk" data-ppt-root><div class="m-head">影响 × 可能性</div><div class="m-head">低</div><div class="m-head">中</div><div class="m-head">高</div><div class="m-axis">高影响</div>${cells.slice(0,3).join("")}<div class="m-axis">中影响</div>${cells.slice(3,6).join("")}<div class="m-axis">低影响</div>${cells.slice(6,9).join("")}</section>`;
}

function renderScatter(p) {
  const items = list(p.items, 4, 10, "items"); const colors = ["#285b86","#467ca3","#6797b7","#8bb0c8","#bd744b","#d0916c","#607d98","#86a0b3","#4f8b78","#9e7d9c"];
  const points = items.map((item, i) => `<div class="point" style="left:${70 + Number(item.x) * 4.05}px;top:${430 - Number(item.y) * 4.05}px;--point:${colors[i]}">${i + 1}</div>`).join("");
  return `<section class="rev rev-scatter" data-ppt-root><div class="plot"><svg viewBox="0 0 520 462"><rect x="70" y="25" width="405" height="405" rx="12" fill="#f5f9fc" stroke="#cfdeea" stroke-width="2"/><path d="M272.5 25V430M70 227.5H475" stroke="#c7d9e7" stroke-width="2" stroke-dasharray="7 7"/><path d="M70 430H500M70 455V25" stroke="#6586a3" stroke-width="3"/><text x="275" y="460" fill="#395a76" text-anchor="middle" font-size="18">${esc(p.axes.x)}</text><text x="18" y="228" fill="#395a76" text-anchor="middle" font-size="18" transform="rotate(-90 18 228)">${esc(p.axes.y)}</text></svg>${points}</div><div class="legend">${items.map((item, i) => `<article class="legend-row"><span class="legend-index" style="--point:${colors[i]}">${i + 1}</span>${flow(`items[${i}]`, { title: item.title, body: `${p.axes.x} ${item.x} · ${p.axes.y} ${item.y}` }, { id: `scatter-item-${i}` })}</article>`).join("")}</div></section>`;
}

function renderZigzag(p) {
  const items = list(p.items, 3, 6, "items");
  return `<section class="rev rev-zigzag" data-ppt-root>${items.map((item, i) => `<article class="step" data-order="${String(i + 1).padStart(2,"0")}"><div class="angled">${String(i + 1).padStart(2,"0")} · ${esc(item.title)}</div>${flow(`items[${i}]`, { body: item.body }, { id: `zigzag-item-${i}` })}</article>${i < items.length - 1 ? '<span class="connector">›</span>' : ''}`).join("")}</section>`;
}

function renderRaci(p) {
  const tasks = list(p.tasks, 3, 5, "tasks"); const roles = list(p.roles, 2, 4, "roles");
  if (!Array.isArray(p.assignments) || p.assignments.length < tasks.length) throw new Error("assignments 缺失");
  const rows = tasks.flatMap((task, i) => [`<div class="cell task">${scalar(`tasks[${i}]`, task)}</div>`, ...roles.map((_, j) => { const code = String(p.assignments[i]?.[j] ?? "").toUpperCase(); return `<div class="cell"><span class="code ${esc(code)}">${esc(code || "·")}</span></div>`; })]).join("");
  return `<section class="rev rev-raci" data-ppt-root><div class="matrix" style="--roles:${roles.length};--tasks:${tasks.length}"><div class="cell head">任务 / 角色</div>${roles.map((role, i) => `<div class="cell head">${scalar(`roles[${i}]`, role)}</div>`).join("")}${rows}</div><div class="legend"><span>R 负责</span><span>A 批准</span><span>C 协作</span><span>I 知会</span></div></section>`;
}

function renderBalance(p) {
  const count = Number(p.itemCount ?? Math.min(p.pros.length, p.cons.length)); const pros = p.pros.slice(0, count); const cons = p.cons.slice(0, count);
  return `<section class="rev rev-balance" data-ppt-root><div class="topic">${flow("topic", { title: p.topic }, { id: "balance-topic", align: "center" })}</div><div class="beam"></div><div class="pivot"></div><section class="pan left"><h3>优势</h3><ul>${pros.map((item, i) => `<li>${scalar(`pros[${i}]`, item)}</li>`).join("")}</ul></section><section class="pan right"><h3>代价 / 风险</h3><ul>${cons.map((item, i) => `<li>${scalar(`cons[${i}]`, item)}</li>`).join("")}</ul></section><div class="verdict tone-dark">${flow("verdict", { title: p.verdict }, { id: "balance-verdict", align: "center", tone: "dark" })}</div></section>`;
}

function renderIceberg(p) {
  const visible = list(p.visible, 1, 5, "visible"); const hidden = list(p.hidden, 2, 5, "hidden");
  const pointPath = (points) => `M ${points} Z`;
  const shiftPoints = (points, dx, dy) => points.split(/\s+/).map((pair) => {
    const [x, y] = pair.split(",").map(Number);
    return `${x + dx},${y + dy}`;
  }).join(" ");
  const boundaries = {
    2: [184, 326, 468],
    3: [184, 278, 374, 468],
    4: [184, 252, 324, 396, 468],
    5: [184, 238, 294, 352, 410, 468],
  }[hidden.length];
  const palette = ["#dceaf2", "#c5dbe7", "#a9c7d8", "#82a9c1", "#5e87a5"];
  const bands = hidden.map((_, i) => {
    const y1 = boundaries[i], y2 = boundaries[i + 1], mid = (y1 + y2) / 2;
    const width = mid < 245 ? 410 : mid < 335 ? 470 : mid < 405 ? 395 : 320;
    return {
      y1, y2,
      frame: { left: 585 - width / 2, top: y1 + 5, width, height: y2 - y1 - 10 },
    };
  });
  const upperGeometry = {
    1: {
      outline: "425,178 486,119 560,22 626,106 745,178",
      facets: ["425,178 486,119 560,22 528,178", "560,22 626,106 651,178 528,178", "626,106 745,178 651,178"],
      labelFrames: [{ left: 500, top: 108, width: 150, height: 54 }],
    },
    2: {
      outline: "380,178 452,105 520,122 598,24 674,109 790,178",
      facets: ["380,178 452,105 520,122 520,178", "520,122 598,24 618,178 520,178", "598,24 674,109 690,178 618,178", "674,109 790,178 690,178"],
      labelFrames: [{ left: 416, top: 126, width: 112, height: 46 }, { left: 604, top: 112, width: 126, height: 56 }],
    },
    3: {
      outline: "330,178 416,122 470,132 558,18 617,94 667,82 840,178",
      facets: ["330,178 416,122 470,132 514,178", "470,132 558,18 617,94 632,178 514,178", "617,94 667,82 728,178 632,178", "667,82 840,178 728,178"],
      labelFrames: [{ left: 391, top: 135, width: 112, height: 38 }, { left: 526, top: 112, width: 112, height: 56 }, { left: 674, top: 119, width: 118, height: 52 }],
    },
    4: {
      outline: "255,178 352,128 419,70 478,132 551,18 612,104 681,65 748,130 915,178",
      facets: ["255,178 352,128 419,70 438,178", "419,70 478,132 551,18 575,178 438,178", "551,18 612,104 655,178 575,178", "612,104 681,65 748,130 770,178 655,178", "748,130 915,178 770,178"],
      labelFrames: [{ left: 328, top: 132, width: 104, height: 42 }, { left: 456, top: 119, width: 108, height: 52 }, { left: 584, top: 112, width: 104, height: 58 }, { left: 735, top: 134, width: 112, height: 40 }],
    },
    5: {
      outline: "185,178 314,126 382,82 445,135 520,22 578,104 642,58 706,130 779,88 848,137 985,178",
      facets: ["185,178 314,126 382,82 404,178", "382,82 445,135 520,22 548,178 404,178", "520,22 578,104 642,58 666,178 548,178", "642,58 706,130 779,88 812,178 666,178", "779,88 848,137 985,178 812,178"],
      labelFrames: [{ left: 291, top: 127, width: 105, height: 47 }, { left: 421, top: 116, width: 108, height: 56 }, { left: 551, top: 105, width: 108, height: 66 }, { left: 684, top: 117, width: 108, height: 55 }, { left: 812, top: 132, width: 112, height: 42 }],
    },
  }[visible.length];
  const visibleFrames = upperGeometry.labelFrames;
  const baseHalf = [0,160,205,255,330,400][visible.length];
  const leftBoundary = [[585-baseHalf,184],[585-baseHalf-34,251],[585-baseHalf-2,314],[585-baseHalf+33,354],[585-baseHalf+75,380],[447,419],[510,468]];
  const rightBoundary = [[585+baseHalf,184],[585+baseHalf+44,251],[585+baseHalf+22,307],[585+baseHalf-8,349],[585+baseHalf-44,374],[752,427],[660,468]];
  const boundaryX = (points, y) => {
    const index = Math.max(0, points.findIndex((point) => point[1] >= y) - 1);
    const [x1, y1] = points[index];
    const [x2, y2] = points[Math.min(index + 1, points.length - 1)];
    if (y2 === y1) return x1;
    return x1 + (x2 - x1) * ((y - y1) / (y2 - y1));
  };
  const lowerSilhouette = `${leftBoundary.map(([x,y]) => `${x},${y}`).join(" ")} ${[...rightBoundary].reverse().map(([x,y]) => `${x},${y}`).join(" ")}`;
  const bandPaths = bands.map((band) => `${boundaryX(leftBoundary, band.y1)},${band.y1} ${boundaryX(rightBoundary, band.y1)},${band.y1} ${boundaryX(rightBoundary, band.y2)},${band.y2} ${boundaryX(leftBoundary, band.y2)},${band.y2}`);
  return `<section class="rev rev-iceberg" data-ppt-root data-visible-count="${visible.length}" data-hidden-count="${hidden.length}">
    <svg class="iceberg-art" viewBox="0 0 1170 492" role="img" aria-label="水上成果与水下支撑构成的抽象冰山">
      <path d="${pointPath(shiftPoints(upperGeometry.outline,0,7))}" fill="#284f70" opacity=".07" data-ppt-kind="path" data-ppt-name="iceberg-upper-shadow"/>
      <path d="${pointPath(shiftPoints(lowerSilhouette,0,7))}" fill="#284f70" opacity=".07" data-ppt-kind="path" data-ppt-name="iceberg-lower-shadow"/>
      <path class="water-glint" d="M0 194 C155 184 270 202 412 191 M758 191 C900 201 1018 184 1170 194" fill="none" data-ppt-kind="path" data-ppt-name="iceberg-water-glint"/>
      <path class="berg-piece" d="${pointPath(upperGeometry.outline)}" fill="#e7f1f6" data-ppt-kind="path" data-ppt-name="iceberg-upper-base"/>
      ${upperGeometry.facets.map((points, i) => `<path class="berg-piece" d="${pointPath(points)}" fill="${["#f3f7fa","#dce9f1","#cfe1eb","#c3d9e6","#b8d2e1"][i]}" data-ppt-kind="path" data-ppt-name="iceberg-upper-facet-${i}"/>`).join("")}
      ${bandPaths.map((points, i) => `<path class="berg-piece" d="${pointPath(points)}" fill="${palette[i]}" data-ppt-kind="path" data-ppt-name="iceberg-hidden-band-${i}"/>`).join("")}
      <path d="${pointPath("585,184 716,292 650,468 548,468 474,324")}" fill="#fff" opacity=".13" data-ppt-kind="path" data-ppt-name="iceberg-lower-highlight-center"/>
      <path d="${pointPath(`${boundaryX(leftBoundary,251)},251 474,324 447,419 ${boundaryX(leftBoundary,314)},314`)}" fill="#fff" opacity=".09" data-ppt-kind="path" data-ppt-name="iceberg-lower-highlight-left"/>
      <path d="${pointPath(lowerSilhouette)}" fill="none" stroke="#fff" stroke-width="4" stroke-linejoin="round" data-ppt-kind="path" data-ppt-name="iceberg-lower-outline"/>
      <path class="waterline" d="M0 178 H1170" fill="none" data-ppt-kind="path" data-ppt-name="iceberg-waterline"/>
    </svg>
    ${visible.map((item, i) => { const frame = visibleFrames[i]; return `<div class="visible-label" style="left:${frame.left}px;top:${frame.top}px;width:${frame.width}px;height:${frame.height}px">${flow(`visible[${i}]`, { title: item }, { id: `iceberg-visible-${i}`, align: "center" })}</div>`; }).join("")}
    ${hidden.map((item, i) => { const frame = bands[i].frame; return `<div class="hidden-label ${i >= Math.max(2, hidden.length - 1) ? "tone-deep" : ""}" style="left:${frame.left}px;top:${frame.top}px;width:${frame.width}px;height:${frame.height}px">${flow(`hidden[${i}]`, { title: item }, { id: `iceberg-hidden-${i}`, align: "center", tone: i >= Math.max(2, hidden.length - 1) ? "dark" : "light" })}</div>`; }).join("")}
  </section>`;
}

function renderDomain(p) {
  const layers = list(p.layers, 3, 5, "layers"); const domains = list(p.domains, 2, 4, "domains");
  return `<section class="rev rev-domain" data-ppt-root><div class="domain-columns" style="--domains:${domains.length}">${domains.map((domain, i) => `<div class="domain-label">${scalar(`domains[${i}]`, domain)}</div>`).join("")}</div><div class="layers" style="grid-template-rows:repeat(${layers.length},1fr)">${layers.map((layer, i) => `<section class="layer" style="--domains:${domains.length};--layer-color:${i % 2 ? '#7da5be' : '#4f82a5'}"><span class="layer-name">${scalar(`layers[${i}]`, layer)}</span>${domains.map((_, j) => `<div class="capability">${scalar(`cells[${i}][${j}]`, p.cells[i][j])}</div>`).join("")}</section>`).join("")}</div></section>`;
}

function renderAuthority(p) {
  const tiers = list(p.tiers, 3, 5, "tiers");
  return `<section class="rev rev-authority" data-ppt-root><div class="authority-stack" style="grid-template-rows:repeat(${tiers.length},1fr)">${tiers.map((tier, i) => { const width = 64 + i * (30 / Math.max(1, tiers.length - 1)); const color = ["#2f6188","#477b9f","#6492af","#81a8bf","#9bb9c9"][i]; return `<section class="authority-band" style="--band-width:${width}%;--band-color:${color}"><span class="authority-name">${scalar(`tiers[${i}].name`, tier.name)}</span>${list(tier.roles, 1, 4, `tiers[${i}].roles`).map((role, j) => `<span class="role-pill">${scalar(`tiers[${i}].roles[${j}]`, role)}</span>`).join("")}</section>`; }).join("")}</div></section>`;
}

function renderCrosscut(p) {
  const layers = list(p.layers, 3, 5, "layers"); const rails = list(p.rails, 2, 3, "rails");
  return `<section class="rev rev-crosscut" data-ppt-root><div class="layer-stack" style="grid-template-rows:repeat(${layers.length},1fr)">${layers.map((layer, i) => `<article class="layer-bar"><span class="layer-title-fixed">${scalar(`layers[${i}].title`, layer.title)}</span>${flow(`layers[${i}].body`, { body: layer.body }, { id: `crosscut-layer-${i}` })}</article>`).join("")}</div><aside class="rail-zone" style="--rails:${rails.length}">${rails.map((rail, i) => `<div class="rail">${scalar(`rails[${i}]`, rail)}</div>`).join("")}</aside></section>`;
}

function renderRejoin(p) {
  const routes = list(p.routes, 2, 4, "routes");
  const ys = routes.map((_, i) => 62 + i * (368 / Math.max(1, routes.length - 1)));
  return `<section class="rev rev-rejoin" data-ppt-root><svg viewBox="0 0 1170 492">${ys.map((y) => `<path d="M200 246 C245 246 230 ${y} 270 ${y}" fill="none" stroke="#9bb4c4" stroke-width="4"/><path d="M900 ${y} C940 ${y} 925 246 970 246" fill="none" stroke="#9bb4c4" stroke-width="4"/>`).join("")}</svg><div class="endpoint start tone-dark">${flow("start", { title: p.start }, { id: "rejoin-start", align: "center", tone: "dark" })}</div><div class="routes" style="grid-template-rows:repeat(${routes.length},1fr)">${routes.map((route, i) => `<article class="route"><span class="route-no">${String(i + 1).padStart(2,"0")}</span>${flow(`routes[${i}]`, route, { id: `rejoin-route-${i}` })}</article>`).join("")}</div><div class="endpoint result tone-dark">${flow("result", { title: p.result }, { id: "rejoin-result", align: "center", tone: "dark" })}</div></section>`;
}

function renderMerge(p) {
  const inputs = list(p.inputs, 4, 6, "inputs"); const themes = p.themes.slice(0, Math.ceil(inputs.length / 2));
  return `<section class="rev rev-merge" data-ppt-root><svg viewBox="0 0 1170 492">${inputs.map((_, i) => { const y1 = 39 + i * (414 / Math.max(1, inputs.length - 1)); const y2 = 110 + Math.floor(i / 2) * (272 / Math.max(1, themes.length - 1)); return `<path d="M280 ${y1} C350 ${y1} 380 ${y2} 455 ${y2}" fill="none" stroke="#a4bbc9" stroke-width="3"/>`; }).join("")}${themes.map((_, i) => { const y = 110 + i * (272 / Math.max(1, themes.length - 1)); return `<path d="M725 ${y} C800 ${y} 830 246 904 246" fill="none" stroke="#a4bbc9" stroke-width="3"/>`; }).join("")}</svg><div class="merge-inputs" style="grid-template-rows:repeat(${inputs.length},1fr)">${inputs.map((input, i) => `<div class="merge-input-node">${scalar(`inputs[${i}]`, input)}</div>`).join("")}</div><div class="merge-themes tone-dark" style="grid-template-rows:repeat(${themes.length},1fr)">${themes.map((theme, i) => `<div class="merge-theme-node">${flow(`themes[${i}]`, { title: theme }, { id: `merge-theme-${i}`, align: "center", tone: "dark" })}</div>`).join("")}</div><div class="merge-result-node tone-dark">${flow("result", { title: p.result }, { id: "merge-result", align: "center", tone: "dark" })}</div></section>`;
}

const definitions = {
  "cycle-pdca-roles-005": { render: renderPdca, preview: { center: "持续改进", detailLevel: 2, steps: [{ code: "P", title: "计划", body: "明确目标、范围与验收标准" }, { code: "D", title: "执行", body: "按约束实施并留下过程记录" }, { code: "C", title: "检查", body: "对照目标识别偏差与原因" }, { code: "A", title: "改进", body: "固化有效做法并进入下一轮" }] } },
  "hierarchy-unbalanced-wbs-005": { render: renderWbs, preview: { root: "Visual Skill 建设", packages: [{ title: "来源蒸馏", tasks: ["选页", "结构描述", "黄金复现"] }, { title: "组件扩散", tasks: ["数量状态", "内容槽位"] }, { title: "审核入库", tasks: ["HTML 审核", "Native 检查", "用户确认"] }, { title: "运行反馈", tasks: ["失败记录"] }] } },
  "hub-two-tier-capabilities-004": { render: renderTwoHub, preview: { center: "可靠 PPTX 生成", inner: ["内容理解", "结构选择", "响应布局", "原生编译"], outer: ["稿件适配", "叙事连贯", "逻辑清晰", "数量扩散", "风格一致", "对象可编", "失败可诊断", "资产可演进"] } },
  "hub-directed-outcomes-002": { render: renderDirected, preview: { center: { title: "响应式引擎", body: "统一求解结构与内容边界" }, items: [{ title: "输出可靠", body: "减少随机排版与结构误用" }, { title: "原生可编", body: "形状和文字均能继续编辑" }, { title: "生成高效", body: "运行期只做选择与参数填写" }, { title: "数量适配", body: "按真实内容重新求解布局" }, { title: "风格一致", body: "共享同一 Shell 与视觉语言" }, { title: "过程可审", body: "来源组件结果统一查看" }] } },
  "parallel-featured-peers-005": { render: renderFeatured, preview: { lead: { title: "可靠生成", body: "这是本页唯一需要被强调的主项" }, peers: [{ title: "原生编辑", body: "所有结构保留为可修改对象" }, { title: "逻辑调用", body: "按表达关系选择审核组件" }, { title: "响应布局", body: "随项目数量自动重排" }, { title: "失败兜底", body: "缺少结构时回到简洁排版" }] } },
  "parallel-grouped-clusters-004": { render: renderClusters, preview: { groups: [{ title: "内容能力", items: [{ title: "理解", body: "识别主题、事实与关系" }, { title: "编排", body: "拆页并建立叙事" }] }, { title: "视觉能力", items: [{ title: "选择", body: "匹配逻辑结构" }, { title: "布局", body: "响应数量与容量" }] }, { title: "交付能力", items: [{ title: "编辑", body: "保持对象原生" }, { title: "质检", body: "检查越界与冲突" }] }] } },
  "matrix-risk-nine-grid-006": { render: renderRisk, preview: { objects: [{ name: "内容越界", likelihood: 3, impact: 3 }, { name: "字体缺失", likelihood: 2, impact: 2 }, { name: "媒体缺少", likelihood: 2, impact: 3 }, { name: "结构误选", likelihood: 2, impact: 3 }, { name: "编译差异", likelihood: 1, impact: 3 }, { name: "颜色偏差", likelihood: 2, impact: 1 }, { name: "文本稀疏", likelihood: 3, impact: 1 }, { name: "来源失效", likelihood: 1, impact: 2 }, { name: "状态遗漏", likelihood: 2, impact: 2 }] } },
  "matrix-scored-scatter-002": { render: renderScatter, preview: { axes: { x: "实施可行性", y: "预期价值" }, items: [{ title: "响应布局", x: 88, y: 92 }, { title: "资产蒸馏", x: 72, y: 84 }, { title: "统一看板", x: 82, y: 68 }, { title: "视觉编排", x: 64, y: 76 }, { title: "自动质检", x: 58, y: 61 }, { title: "模板换肤", x: 90, y: 48 }, { title: "多层嵌套", x: 42, y: 87 }, { title: "生态扩展", x: 35, y: 55 }, { title: "跨域编排", x: 48, y: 44 }, { title: "实时协作", x: 70, y: 52 }] } },
  "sequence-zigzag-cards-002": { render: renderZigzag, preview: { items: [{ title: "识别情境", body: "确认目标、边界和约束" }, { title: "形成方案", body: "围绕目标组织路径" }, { title: "推进执行", body: "按节奏完成关键动作" }, { title: "复盘校正", body: "根据结果调整下一轮" }, { title: "固化能力", body: "沉淀可复用的方法" }, { title: "规模扩散", body: "推广到更多场景" }] } },
  "matrix-responsibility-grid-003": { render: renderRaci, preview: { tasks: ["内容拆页", "结构组选择", "HTML 布局", "Native 编译", "最终质检"], roles: ["内容导演", "视觉导演", "组件运行时", "质量模块"], assignments: [["R","A","C","I"],["C","R","A","I"],["I","A","R","C"],["I","A","R","C"],["C","A","I","R"]] } },
  "comparison-pros-cons-balance-005": { render: renderBalance, preview: { topic: "是否采用 HTML 单一布局源", pros: ["数量状态可响应扩散", "审美可在浏览器审核", "布局结果能够机械编译", "运行期无需重新设计"], cons: ["复杂 CSS 需要限制", "媒体依赖必须声明", "编译边界仍需完善", "候选资产需要人工审核"], verdict: "收益明确，但必须以已审核组件和失败边界为前提", itemCount: 3 } },
  "layered-iceberg-depth-006": { render: renderIceberg, preview: { visible: ["页面美感", "叙事清晰", "原生可编辑", "结构可靠", "风格统一"], hidden: ["已审核结构资产", "响应式布局规则", "字段容量与失败边界", "统一编译与质量检查", "稳定运行基础"] } },
  "layered-domain-grid-003": { render: renderDomain, preview: { layers: ["体验层", "应用层", "能力层", "数据层", "基础层"], domains: ["内容生产", "资产管理", "正式生成", "质量审查"], cells: [["交互入口","资产看板","稿件输入","审核反馈"],["导演编排","状态切换","页面生成","结果预览"],["Logic 选择","契约解析","HTML 编译","边界检查"],["内容结构","资产索引","参数载荷","质量记录"],["模型服务","组件运行时","PPT 引擎","文件存储"]] } },
  "hierarchy-tiered-authority-004": { render: renderAuthority, preview: { tiers: [{ name: "决策层", roles: ["产品负责人"] }, { name: "编排层", roles: ["内容导演", "视觉导演"] }, { name: "执行层", roles: ["组件运行时", "原生编译", "质量检查"] }, { name: "资产层", roles: ["Skin", "Composition", "Visual Skill"] }, { name: "来源层", roles: ["稿件", "模板", "媒体"] }] } },
  "layered-crosscut-rails-004": { render: renderCrosscut, preview: { layers: [{ title: "交互层", body: "稿件输入、预览审核与结果交付" }, { title: "编排层", body: "内容导演与视觉导演协同决策" }, { title: "运行层", body: "结构解析、布局求解与原生编译" }, { title: "资产层", body: "Shell、Composition 与 Visual Skill" }, { title: "来源层", body: "PPT 模板、HTML 参考与媒体资产" }], rails: ["设计规范", "质量约束", "版本治理"] } },
  "branching-rejoin-routes-002": { render: renderRejoin, preview: { start: "形成明确的研究问题", routes: [{ title: "文献路径", body: "梳理理论脉络并识别证据缺口" }, { title: "数据路径", body: "采集同条件样本并进行实证分析" }, { title: "访谈路径", body: "补充机制解释与情境边界" }, { title: "仿真路径", body: "验证关键假设在控制条件下的表现" }], result: "形成可检验的综合结论" } },
  "convergence-staged-merge-004": { render: renderMerge, preview: { inputs: ["稿件事实与观点", "页面目标与语境", "逻辑关系与层级", "结构容量与槽位", "视觉规范与风格", "前后页叙事节奏"], themes: ["内容意图", "结构约束", "视觉上下文"], result: "形成可执行且可验证的页面决策" } },
};

function resolve(id, base, selection = {}) {
  const value = clone(base); const n = (key, fallback) => Number(selection[key] ?? fallback);
  if (id === "hierarchy-unbalanced-wbs-005") value.packages = value.packages.slice(0, n("packageCount", 3));
  if (id === "hub-two-tier-capabilities-004") { value.inner = value.inner.slice(0, n("innerCount", 4)); value.outer = value.outer.slice(0, n("outerCount", 6)); }
  if (id === "hub-directed-outcomes-002") value.items = value.items.slice(0, n("itemCount", 6));
  if (id === "parallel-featured-peers-005") value.peers = value.peers.slice(0, n("peerCount", 4));
  if (id === "parallel-grouped-clusters-004") value.groups = value.groups.slice(0, n("groupCount", 3));
  if (id === "matrix-risk-nine-grid-006") value.objects = value.objects.slice(0, n("objectCount", 7));
  if (id === "matrix-scored-scatter-002") value.items = value.items.slice(0, n("itemCount", 6));
  if (id === "sequence-zigzag-cards-002") value.items = value.items.slice(0, n("itemCount", 4));
  if (id === "matrix-responsibility-grid-003") { const t=n("taskCount",4),r=n("roleCount",4); value.tasks=value.tasks.slice(0,t); value.roles=value.roles.slice(0,r); value.assignments=value.assignments.slice(0,t).map((row)=>row.slice(0,r)); }
  if (id === "comparison-pros-cons-balance-005") value.itemCount = n("itemCount", 3);
  if (id === "layered-iceberg-depth-006") { value.visible=value.visible.slice(0,n("visibleCount",3)); value.hidden=value.hidden.slice(0,n("hiddenCount",3)); }
  if (id === "layered-domain-grid-003") { const l=n("layerCount",4),d=n("domainCount",3); value.layers=value.layers.slice(0,l); value.domains=value.domains.slice(0,d); value.cells=value.cells.slice(0,l).map((row)=>row.slice(0,d)); }
  if (id === "hierarchy-tiered-authority-004") value.tiers = value.tiers.slice(0, n("tierCount", 4));
  if (id === "layered-crosscut-rails-004") { value.layers=value.layers.slice(0,n("layerCount",4)); value.rails=value.rails.slice(0,n("railCount",2)); }
  if (id === "branching-rejoin-routes-002") value.routes = value.routes.slice(0, n("routeCount", 3));
  if (id === "convergence-staged-merge-004") { value.inputs=value.inputs.slice(0,n("inputCount",6)); value.themes=value.themes.slice(0,Math.ceil(value.inputs.length/2)); }
  return value;
}

export function getCandidate(id) {
  const definition = definitions[id];
  if (!definition) throw new Error(`未知修订组件：${id}`);
  return {
    visualComponent: Object.freeze({ id, schemaVersion: 5, designFrame: FRAME, textCapacity: { maxTextChars: 42 }, renderMarkup(parameters) { return `<style>${CSS}</style>${definition.render(parameters)}`; } }),
    previewParameters: Object.freeze(definition.preview),
    resolvePreviewParameters(base, selection) { return resolve(id, base, selection); },
  };
}
