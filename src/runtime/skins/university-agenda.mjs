// Approved university agenda: large index + blue gradient chapter band.
const gradient={type:'gradient',gradientKind:'linear',angleDeg:0,stops:[{offset:0,color:'#305493'},{offset:100000,color:'#5796EE'}]};
export function universityAgendaGrid(count){
  if(!Number.isInteger(count)||count<0||count>8) throw new RangeError('大学目录单页支持 1–8 章；超过 8 章请拆页');
  return {columns:count<=4?Math.max(1,count):count<=6?3:4,rows:count<=4?1:2};
}
function box(slide,x,y,w,h,fill){return slide.shapes.add({geometry:'rect',position:{left:x,top:y,width:w,height:h},fill,line:{fill:'none',width:0}});}
function label(slide,value,x,y,w,h,size,color,bold=false,font='Microsoft YaHei'){
  const q=box(slide,x,y,w,h,'none');q.text=value;
  q.text.style={typeface:font,fontSize:size,color,bold,autoFit:'none',wrap:true,verticalAlignment:'middle',insets:{left:0,right:0,top:0,bottom:0}};
}
export function renderUniversityAgenda(slide,items=[]){
  const {columns,rows}=universityAgendaGrid(items.length);
  const step=1110/columns,width=step-(columns===4?34:50),two=rows===2;
  items.forEach((item,i)=>{
    const title=typeof item==='string'?item:item.title;
    const description=typeof item==='string'?'':item.description||'';
    const x=105+(i%columns)*step,y=two?190+Math.floor(i/columns)*232:251;
    const size=columns===4?23:28, descSize=columns===4?16:18;
    if(!title||[...title].length>Math.floor((width-32)/size)) throw new Error(`目录第 ${i+1} 章标题过长，请精炼为单行短标题`);
    if([...description].length>Math.floor(width/descSize)*2) throw new Error(`目录第 ${i+1} 章说明过长，请精炼`);
    label(slide,String(i+1).padStart(2,'0'),x,y,width,two?62:87,two?46:66,'#315F91',false,'Georgia');
    const bandY=y+(two?73:114);
    box(slide,x,bandY,width,54,gradient);
    label(slide,title,x+16,bandY+2,width-32,50,size,'#FFFFFF',true);
    if(description) label(slide,description,x+2,bandY+66,width-2,44,descSize,'#687D92');
    box(slide,x,bandY+(two?119:145),36,3,'#315F91');
    if(i%columns<columns-1&&i<items.length-1) box(slide,x+width+(step-width)/2,y+24,1,two?170:240,'#DCE4ED');
  });
}
