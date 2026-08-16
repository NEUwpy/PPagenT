import { cloneParameters, escapeHtml, requireCount, text } from "../../../src/visual-runtime/component-authoring.mjs";

function normalize(parameters){
  const lanes=requireCount(parameters?.lanes,2,3,"泳道角色").map(text); const stages=requireCount(parameters?.stages,2,3,"泳道阶段").map(text);
  const tasks=(parameters?.tasks??[]).filter((task)=>Number.isInteger(task?.lane)&&Number.isInteger(task?.stage)&&task.lane<lanes.length&&task.stage<stages.length).map((task)=>({...task,label:text(task.label)}));
  return {lanes,stages,tasks,conclusion:text(parameters?.conclusion)};
}
export const visualComponent=Object.freeze({
  id:"swimlane-process-default",schemaVersion:4,designFrame:{width:1170,height:492},cssFile:"component.css",
  renderMarkup(parameters){
    const model=normalize(parameters); const taskMap=new Map(model.tasks.map((task)=>[`${task.lane}:${task.stage}`,task.label]));
    const headers=model.stages.map((stage,index)=>`<div class="swim-stage" style="--column:${index}" data-ppt-kind="shape-text" data-ppt-shape="roundRect" data-ppt-name="swim-stage-${index}">${escapeHtml(stage)}</div>`).join("");
    const rows=model.lanes.map((lane,laneIndex)=>`<div class="swim-lane" style="--row:${laneIndex}" data-ppt-kind="shape-text" data-ppt-shape="roundRect" data-ppt-name="swim-lane-${laneIndex}">${escapeHtml(lane)}</div>${model.stages.map((_,stageIndex)=>{const label=taskMap.get(`${laneIndex}:${stageIndex}`);return `<div class="swim-cell" style="--row:${laneIndex};--column:${stageIndex}" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-name="swim-cell-${laneIndex}-${stageIndex}"></div>${label?`<div class="swim-task" style="--row:${laneIndex};--column:${stageIndex}" data-ppt-kind="shape-text" data-ppt-shape="roundRect" data-ppt-name="swim-task-${laneIndex}-${stageIndex}">${escapeHtml(label)}</div>`:""}`;}).join("")}`).join("");
    return `<section class="swim-root" data-ppt-root data-lanes="${model.lanes.length}" data-stages="${model.stages.length}" style="--lanes:${model.lanes.length};--stages:${model.stages.length}"><div class="swim-corner" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-name="swim-corner"></div>${headers}${rows}${model.conclusion?`<div class="swim-conclusion" data-ppt-kind="shape-text" data-ppt-shape="roundRect" data-ppt-name="swim-conclusion">${escapeHtml(model.conclusion)}</div>`:""}</section>`;
  }
});
export const previewParameters=Object.freeze({title:"跨角色协同流程",lanes:["内容团队","视觉团队","工程团队"],stages:["理解","设计","交付"],tasks:[{lane:0,stage:0,label:"拆解稿件"},{lane:0,stage:1,label:"确认页面内容"},{lane:0,stage:2,label:"内容验收"},{lane:1,stage:0,label:"判断视觉关系"},{lane:1,stage:1,label:"选择 Style Group"},{lane:1,stage:2,label:"视觉验收"},{lane:2,stage:0,label:"准备运行参数"},{lane:2,stage:1,label:"生成原生 PPT"},{lane:2,stage:2,label:"交付文件"}],conclusion:"角色边界清楚，信息能够回流"});
export function resolvePreviewParameters(base,selection){const result=cloneParameters(base);result.lanes=result.lanes.slice(0,selection.laneCount);result.stages=result.stages.slice(0,selection.stageCount);result.tasks=result.tasks.filter((task)=>task.lane<selection.laneCount&&task.stage<selection.stageCount);return result;}
