// Keep stage identity across both palettes: each arrow belongs to its band.
export function cycleStageColors(markup, theme) {
  const count = Number(markup.match(/class="cycle-review"[^>]*data-step-count="(\d+)"/)?.[1]);
  if (!count) return '';
  const mix=(a,b,t)=>'#'+[1,3,5].map(i=>Math.round(parseInt(a.slice(i,i+2),16)*(1-t)+parseInt(b.slice(i,i+2),16)*t).toString(16).padStart(2,'0')).join('');
  const neutral=theme.id==='neutral-editorial-001';
  const start=neutral?theme.surface:mix(theme.primaryColor,theme.background,.78);
  const end=neutral?(theme.intensity4??theme.muted):mix(theme.primaryColor,theme.background,.30);
  return Array.from({length:count},(_,i)=>{
    const color=mix(start,end,i/Math.max(1,count-1));
    return `.cycle-review [data-ppt-name="cycle-band-${i}"],.cycle-review [data-ppt-name="cycle-arrow-${i}"]{fill:${color};stroke:none}`;
  }).join('')+`.cycle-review .cycle-title,.cycle-review .cycle-number,.cycle-review .cycle-english{fill:${theme.dark};opacity:1}`;
}
