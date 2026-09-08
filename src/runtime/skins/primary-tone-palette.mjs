// The only color input is the Skin main tone. All roles share one fixed recipe.
export function derivePrimaryTheme(skin, mainColor) {
 if (!/^#[0-9a-f]{6}$/i.test(mainColor)) throw new Error('主色必须为六位十六进制颜色');
 const shade=t=>'#'+[1,3,5].map(i=>Math.round(parseInt(mainColor.slice(i,i+2),16)*(1-t)).toString(16).padStart(2,'0')).join('').toUpperCase();
 // Derive the warm accessory hue from the same seed; no second color input.
 const rgb=[1,3,5].map(i=>parseInt(mainColor.slice(i,i+2),16)/255);
 const hi=Math.max(...rgb),lo=Math.min(...rgb),d=hi-lo,l=(hi+lo)/2;
 const sat=d===0?0:d/(1-Math.abs(2*l-1));
 const hue=d===0?0:((hi===rgb[0]?(rgb[1]-rgb[2])/d:hi===rgb[1]?(rgb[2]-rgb[0])/d+2:(rgb[0]-rgb[1])/d+4)*60+360)%360;
 const color=(h,saturation,light)=>{
   h=(h+360)%360;
   saturation=Math.max(0,Math.min(1,saturation));
   light=Math.max(0,Math.min(1,light));
   const c=(1-Math.abs(2*light-1))*saturation,x=c*(1-Math.abs((h/60)%2-1)),m=light-c/2;
   const channels=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];
   return '#'+channels.map(v=>Math.round((v+m)*255).toString(16).padStart(2,'0')).join('').toUpperCase();
 };
 const accent=color(hue-40,sat*1.52,l*.50);
 // Preserve the seed's warm hue as lightness falls, instead of mixing only black.
 const warm=(saturationRatio,lightnessRatio)=>color(hue-3,sat*saturationRatio,l*lightnessRatio);
 // Copy typography and identity only: no colors are inherited from the old Skin.
 return {id:skin.id,fonts:skin.fonts,font:skin.font,typography:skin.typography,
   mainColor,background:shade(0),surface:warm(.93,.963),line:warm(.60,.86),
   intensity3:warm(.40,.77),intensity4:warm(.36,.69),
   muted:warm(.18,.525),dark:warm(.24,.125),body:warm(.33,.295),primaryColor:accent};
}
