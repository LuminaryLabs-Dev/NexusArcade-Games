import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import {newState,engineInventory,acceptReport,verifyCandidate,candidateDigest,nextRequest,treeHash} from '../.agent/plugins/nexus-arcade-builder-kit/cli.mjs';
async function fixture(fn){
 const root=await mkdtemp(path.join(os.tmpdir(),'arcade-builder-'));
 try{
 const repo=path.join(root,'repo'),engineRoot=path.join(root,'engine');
 await mkdir(engineRoot,{recursive:true});await writeFile(path.join(engineRoot,'package.json'),JSON.stringify({name:'fixture-engine',version:'0.0.0',exports:{'.':'./index.mjs'}}));await writeFile(path.join(engineRoot,'index.mjs'),'export const fixture=true;');
 const git=args=>execFileSync('git',['-C',engineRoot,...args],{stdio:'pipe'});
 git(['init']);git(['add','.']);git(['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-m','test fixture']);
 for(const d of ['source','build','install'])await mkdir(path.join(repo,'games/sample',d),{recursive:true});
 await writeFile(path.join(repo,'games/sample/install/game.json'),JSON.stringify({id:'NXA-999999',slug:'sample',status:'fixture'}));
 for(const d of ['source','build'])await writeFile(path.join(repo,'games/sample',d,'index.html'),'<title>Test fixture only</title>');
 const engine=await engineInventory(engineRoot);
 const state=newState({repo,engine,game:'sample',run:'test-run',intent:'Build this isolated test fixture; do not publish it.',config:{authorityReference:'Automated fixture only',allowImplementation:true,allowRegistration:false,requireVisualEvidence:false,commands:[{command:'node',args:['-e','process.exit(0)']}],maxCycles:2},plugin:{sourceDigest:'fixture'}});
 await fn({root,repo,engine,state});
 }finally{await rm(root,{recursive:true,force:true});}
}
async function toQuality(state){
 await acceptReport(state,{status:'complete',engineCommit:state.engineCommit,mapping:[{responsibility:'Fixture runtime',owner:'core-existing',source:'engine:index.mjs',packageExport:'.',decision:'Use actual fixture export'}]});
 await acceptReport(state,{status:'complete',engineCommit:state.engineCommit,steps:['Implement fixture'],acceptance:['Executable fixture passes']});
 await acceptReport(state,{status:'complete',evidencePaths:['games/sample/source/index.html']});
 await verifyCandidate(state);
}
async function quality(state,overrides={}){return {status:'pass',engineCommit:state.engineCommit,artifactDigest:await candidateDigest(state),kind:'inferred-human-factors',blockingFindings:[],criteria:Object.fromEntries(['clarity','agency','feedback','challenge','recovery','coherence','accessibility'].map(k=>[k,{verdict:'pass',observation:'Fixture protocol assertion only, not gameplay evidence',evidencePaths:['games/sample/source/index.html']}])),...overrides};}
test('real source inventory and ordered checks reach quality without publishing',()=>fixture(async({state})=>{await toQuality(state);assert.equal(state.stage,'quality');assert.equal(state.artifacts.verification.results[0].exitCode,0);assert.match(nextRequest(state).intent,/isolated test fixture/);}));
test('quality pass waits for specific registration authority',()=>fixture(async({state})=>{await toQuality(state);await acceptReport(state,await quality(state));assert.equal(state.stage,'register');assert.equal(state.status,'awaiting-approval');await assert.rejects(acceptReport(state,{status:'complete'}),/explicit authority/);}));
test('failed assumptions return to inspection preserving identity and intent',()=>fixture(async({state})=>{await toQuality(state);const intent=state.intent;await acceptReport(state,await quality(state,{status:'fail',blockingFindings:['Wrong assumption'],returnTo:'inspect',remediations:['Inspect source again']}));assert.equal(state.stage,'inspect');assert.equal(state.intent,intent);assert.equal(state.game,'sample');assert.equal(state.cycle,2);assert.deepEqual(state.artifacts,{});}));
test('quality defects return to planning and retain source inspection',()=>fixture(async({state})=>{await toQuality(state);await acceptReport(state,await quality(state,{status:'fail',blockingFindings:['Unclear feedback'],returnTo:'plan',remediations:['Clarify feedback']}));assert.equal(state.stage,'plan');assert.ok(state.artifacts.inspection);assert.equal(state.artifacts.verification,undefined);}));
test('missing hardware blocks rather than retrying',()=>fixture(async({state})=>{await acceptReport(state,{status:'blocked',reason:'Physical target unavailable'});assert.equal(state.status,'blocked');assert.equal(state.cycle,1);}));
test('intent mutation is rejected',()=>fixture(async({state})=>{state.intent+=' changed';await assert.rejects(acceptReport(state,{}),/intent changed/);}));
test('unavailable export cannot be invented',()=>fixture(async({state})=>{await assert.rejects(acceptReport(state,{status:'complete',engineCommit:state.engineCommit,mapping:[{responsibility:'missing',owner:'core-existing',source:'engine:index.mjs',packageExport:'./invented',decision:'Use'}]}),/actual public export/);}));
test('Core change requires separate authority',()=>fixture(async({state})=>{state.stage='plan';await acceptReport(state,{status:'complete',engineCommit:state.engineCommit,steps:['Change Core'],acceptance:['Test'],requiresCoreChanges:true});assert.equal(state.status,'blocked');}));
test('failing executable check cannot be marked passed',()=>fixture(async({state})=>{state.stage='verify';state.config.commands=[{command:'node',args:['-e','process.exit(7)']}];await verifyCandidate(state);assert.equal(state.stage,'plan');assert.equal(state.artifacts.verification,undefined);assert.equal(state.history[0].reason.results[0].exitCode,7);}));
test('changed payload invalidates verification and review',()=>fixture(async({state,repo})=>{await toQuality(state);const report=await quality(state);for(const d of ['source','build'])await writeFile(path.join(repo,'games/sample',d,'index.html'),'changed');await acceptReport(state,report);assert.equal(state.stage,'plan');}));
test('missing criterion and visual evidence cannot pass',()=>fixture(async({state})=>{await toQuality(state);const report=await quality(state);delete report.criteria.agency;await assert.rejects(acceptReport(state,report),/criterion agency/);state.config.requireVisualEvidence=true;await assert.rejects(acceptReport(state,await quality(state)),/Visual/);}));
test('human playtest requirement remains a distinct blocker',()=>fixture(async({state})=>{await toQuality(state);state.config.requireHumanPlaytest=true;await acceptReport(state,await quality(state));assert.equal(state.status,'blocked');assert.match(state.nextAction,/Actual human/);}));
test('retry budget stops an endless loop',()=>fixture(async({state})=>{await toQuality(state);state.cycle=2;await acceptReport(state,await quality(state,{status:'fail',blockingFindings:['Failure'],returnTo:'plan',remediations:['Fix']}));assert.equal(state.status,'budget-exhausted');}));
test('out of order verification and missing implementation authority reject',()=>fixture(async({state,repo,engine})=>{await assert.rejects(verifyCandidate(state),/out of order/);assert.throws(()=>newState({repo,engine,game:'sample',run:'sample',intent:state.intent,config:{commands:state.config.commands},plugin:{}}),/authority/);}));
test('plugin byte hash changes with implementation changes',()=>fixture(async({root})=>{const d=path.join(root,'plugin');await mkdir(d);await writeFile(path.join(d,'test'),'a');const first=await treeHash(d);await writeFile(path.join(d,'test'),'b');assert.notEqual(await treeHash(d),first);}));
