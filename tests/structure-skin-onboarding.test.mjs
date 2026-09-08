import test from 'node:test';
import assert from 'node:assert/strict';
import {validateStructureSkin} from '../src/runtime/skins/structure-skin-registry.mjs';
import {derivePrimaryTheme} from '../src/runtime/skins/primary-tone-palette.mjs';
import {compileHtmlComponentTheme} from '../src/visual-runtime/html-component-theme.mjs';
import {structureCapabilityStatus} from '../src/tools/structure-capability-status.mjs';
test('candidate Skin uses the shared converter without a neutral id',()=>{
 const c=validateStructureSkin({id:'test-sand',name:'测试',mainColor:'#EFE4D2',mode:'continuous-tone-v1',status:'candidate',fonts:{body:'Arial',display:'Arial'}});
 const theme={...derivePrimaryTheme(c,c.mainColor),structureColorMode:c.mode};
 const input={markup:'<section class="funnel-review" data-ppt-root><path fill="#315F91"/></section>',css:'',theme};
 assert.deepEqual(compileHtmlComponentTheme(input),compileHtmlComponentTheme({...input,theme:{...theme,id:'neutral-editorial-001'}}));
 assert.throws(()=>validateStructureSkin({...c,status:'approved'}));
 assert.throws(()=>validateStructureSkin({...c,id:'../escape'}));
});
test('capabilities do not promote full page or all sizes from preview approval',()=>{
 const asset={id:'convergence-many-to-one-003',status:'core',userApprovedHtmlNative:true};
 const s=structureCapabilityStatus(asset,'new-skin');
 assert.equal(s.color,'换色待审阅');assert.deepEqual(s.sizes,['large']);assert.match(s.wholePage,/未逐项登记/);
 assert.deepEqual(structureCapabilityStatus({...asset,id:'convergence-simple-funnel-001'},'neutral').sizes,['large','medium','small']);
});
test('dark brand seeds derive a light canvas without changing the paper palette',()=>{
 const purple=derivePrimaryTheme({},'#660099');
 assert.equal(purple.background,'#FFFFFF');
 assert.equal(purple.primaryColor,'#660099');
 assert.notEqual(purple.surface,purple.background);
 const brightness=c=>[1,3,5].reduce((n,i)=>n+parseInt(c.slice(i,i+2),16),0);
 assert.ok(brightness(purple.surface)>brightness(purple.intensity4));
 assert.ok(brightness(purple.intensity4)>brightness(purple.body));
 assert.equal(derivePrimaryTheme({},'#F5F4EF').surface,'#EEECE4');
});
