export const stylesheet = `
  * { box-sizing: border-box; }
  html, body { margin: 0; background: #f6f5f1; }
  .slide { display: flow-root; width:1280px; height:720px; position:relative; color:#242422; background:#f6f5f1;
    font-family:"Microsoft YaHei",sans-serif; -webkit-font-smoothing: antialiased; }
  .masthead { position:absolute; left:66px; right:auto; top:46px; width:var(--w);
    min-height:94px; display:flex; align-items:baseline; gap:22px; border-bottom:2px solid #292926; }
  .masthead:after { content:""; display:block; position:absolute; bottom:-2px; left:0; height:4px; width:55px; background:#272724; }
  .masthead:has(.deck) { top:40px; min-height:100px; }
  .intro { flex:none; font-size:18px; font-weight:700; color:#484846; }
  .deck { position:absolute; left:0; top:67px; font-size:18px; line-height:1.25; color:#545450; }
  h1 { margin:0; font:650 56px/1.16 "Noto Serif SC","SimSun"; letter-spacing:.01em; text-wrap:balance; }
  main { position:absolute; left:66px; top:var(--top); width:var(--w); height:var(--h); }
  .group { display:grid; grid-template-columns:var(--rail) minmax(0, 1fr); column-gap:var(--rg);
    max-width:100%; padding:var(--pad) 0; border-bottom:1px solid #b8b7af; }
  .group:first-child { padding-top:7px; }
  .group:last-child { border-bottom:0; padding-bottom:0; }
  h2 { margin:0; padding-top:1px; font:700 26px/1.3 "Noto Serif SC","SimSun"; letter-spacing:.015em;
    max-width:100%; color:#292927; text-wrap:balance; }
  .headline .group { grid-template-columns:minmax(0, 1fr); row-gap:8px; }
  .headline h2 { margin:0; font-size:22px; line-height:25px; }
  .columns { display:grid; gap:var(--g); align-items:start; }
  .flow { min-width:0; }
  .unit + .unit { margin-top:var(--ig); }
  h3 { margin:0 0 var(--sg); color:#252523; font-size:var(--head); line-height:var(--head-line);
    font-weight:700; text-wrap:balance; overflow-wrap:break-word; }
  p { margin:0; font-size:var(--base); line-height:var(--body-line); text-wrap:pretty;
    overflow-wrap:break-word; color:#383836; }
`;
