import test from 'node:test';
import assert from 'node:assert/strict';
import {Renderer2D} from '../games/switchyard/source/src/renderer.mjs';
test('station labels are constrained to platform width without removing destination text',()=>{
 const calls=[];const ctx=new Proxy({fillText:(...args)=>calls.push(args)},{get:(target,key)=>key in target?target[key]:()=>{},set:(target,key,value)=>(target[key]=value,true)});
 Renderer2D.prototype.renderStations.call({},ctx);
 assert.equal(calls.length,8);
 for(const [label,x,y,maxWidth] of calls){assert.equal(x,26);assert.equal(maxWidth,68);assert.ok(x+maxWidth<102);assert.ok(label.length>0);}
 assert.ok(calls.some(([label])=>label.includes('MAGENTA')));
});
