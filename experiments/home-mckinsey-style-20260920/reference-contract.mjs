import {validateBlueprint as validateBase} from './style-contract.mjs';
export function validateBlueprint(gray,bp){
  const normalized=structuredClone(bp), errors=[];
  for(const group of normalized.visual?.groups??[]){
    if(group.index==='circle-rail')group.index='rail';
    if(group.heading==='taper')group.heading='wash';
  }
  for(const strip of normalized.detailStrips??[]){
    if(strip.lead!==undefined&&!['none','manifestations'].includes(strip.lead))errors.push('Unsupported structural lead label');
  }
  return [...validateBase(gray,normalized),...errors];
}
