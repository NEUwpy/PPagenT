import fs from 'node:fs/promises';
import {expressionRequirements,validateGrayRegionPlan} from '../../src/runner/gray-expressions.mjs';
import {grayTextSources} from '../../src/render/gray-visual-plan.mjs';
import {loadCompositionLayouts} from '../../src/composition/layouts.mjs';
import {listTextLayouts} from '../../src/visual-runtime/text-layout-library.mjs';
const notePage={items:[{id:'g',kind:'text',heading:'条件',blocks:[{id:'b',label:'适用范围',text:'正文'},{id:'n',kind:'note',text:'必要限定'}]}]};
const basePlan={compositionId:'component-gray-regions',textSlots:[],structure:{sourceLocation:'g',sourceItemIds:['g']}};
const reject=items=>{try{validateGrayRegionPlan({items},basePlan);return null;}catch(e){return e.message;}};
const result={date:'2026-09-28',scope:'synthetic interface probes, not generation or visual acceptance',
 noteExpressions:expressionRequirements(notePage),noteAndLabelTextSources:grayTextSources(notePage.items[0]),
 pureTextHandoff:reject([{id:'g',kind:'text',blocks:[{id:'b',text:'正文'}]}]),
 multipleExpressionHandoff:reject([{id:'g',kind:'diagram'},{id:'h',kind:'flow'}]),
 loadedCompositionIds:[...(await loadCompositionLayouts()).keys()],visibleTextLayouts:listTextLayouts().map(({id,status,visualReviewStatus})=>({id,status,visualReviewStatus}))};
await fs.writeFile('experiments/capability-inventory-20260928/interface-probes.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
