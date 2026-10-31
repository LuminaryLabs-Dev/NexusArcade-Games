import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, cp, rm, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { inspectGame, args } from '../plugins/nexus-arcade/scripts/inspect-game.mjs';
import { validatePlugin } from '../plugins/nexus-arcade/scripts/validate-plugin.mjs';
const root=process.cwd();
async function fixture(fn){const temp=await mkdtemp(path.join(os.tmpdir(),'arcade-plugin-test-'));try{await fn(temp);}finally{await rm(temp,{recursive:true,force:true});}}
async function gameFixture(temp){
 for(const dir of ['source','build','install'])await mkdir(path.join(temp,'games','sample',dir),{recursive:true});
 await writeFile(path.join(temp,'games/sample/install/game.json'),JSON.stringify({id:'NXA-999999',slug:'sample',status:'prototype',registryPending:true}));
 for(const dir of ['source','build'])await writeFile(path.join(temp,'games/sample',dir,'index.html'),'<!doctype html><title>Fixture</title>');
}
async function pluginFixture(temp){
 for(const rel of ['plugins/nexus-arcade','.agents','kits'])await cp(path.join(root,rel),path.join(temp,rel),{recursive:true});
 await mkdir(path.join(temp,'.agent'),{recursive:true});
 await cp(path.join(root,'AGENTS.md'),path.join(temp,'AGENTS.md'));await cp(path.join(root,'.agent/development.md'),path.join(temp,'.agent/development.md'));
 await writeFile(path.join(temp,'.agent/reuse-candidates.json'),JSON.stringify({schemaVersion:1,records:[]}));
}
test('Actual Switchyard is inspected without changing its source or build',async()=>{
 const before=await readFile('games/switchyard/source/src/simulation.mjs');const report=await inspectGame(root,'switchyard');
 assert.equal(report.id,'NXA-000017');assert.equal(report.sourceBuildIdentical,true);assert.equal(report.registryPending,true);assert.ok(report.files.length>5);
 assert.deepEqual(await readFile('games/switchyard/source/src/simulation.mjs'),before);
});
test('Actual repository plugin, skills, links and reuse decisions validate',async()=>{const r=await validatePlugin(root);assert.deepEqual(r.errors,[]);assert.equal(r.status,'PASS');assert.equal(r.skills,5);assert.equal(r.reuseRecords,6);});
test('Inspector detects changed build bytes rather than declaring parity',()=>fixture(async temp=>{await gameFixture(temp);await writeFile(path.join(temp,'games/sample/build/index.html'),'different');assert.equal((await inspectGame(temp,'sample')).sourceBuildIdentical,false);}));
test('Inspector rejects traversal and absent identity',async()=>{await assert.rejects(inspectGame(root,'../switchyard'));await assert.rejects(inspectGame(root,'not-a-real-game'));assert.throws(()=>args(['--repo','.','--repo','other']));});
test('Inspector rejects an escaping symlink without reading its contents',()=>fixture(async temp=>{await gameFixture(temp);await symlink(path.join(root,'package.json'),path.join(temp,'games/sample/build/outside.json'));await assert.rejects(inspectGame(temp,'sample'),/leaves repository/);}));
test('Marketplace cannot point outside the repo plugin',()=>fixture(async temp=>{await pluginFixture(temp);const file=path.join(temp,'.agents/plugins/marketplace.json');const data=JSON.parse(await readFile(file));data.plugins[0].source.path='../outside';await writeFile(file,JSON.stringify(data));assert.equal((await validatePlugin(temp)).status,'FAIL');}));
test('Unsupported server or hook configuration fails skills-only validation',()=>fixture(async temp=>{await pluginFixture(temp);const file=path.join(temp,'plugins/nexus-arcade/plugin.json');const data=JSON.parse(await readFile(file));data.hooks={};await writeFile(file,JSON.stringify(data));assert.equal((await validatePlugin(temp)).status,'FAIL');}));
test('Unproved extraction is rejected even when a second consumer is named',()=>fixture(async temp=>{await pluginFixture(temp);await writeFile(path.join(temp,'.agent/reuse-candidates.json'),JSON.stringify({schemaVersion:1,records:[{id:'claim',classification:'arcade-candidate',responsibility:'A proposed reusable system',alternatives:[],consumers:[{game:'one'},{game:'two'}],decision:'extract-approved',reason:'test',nextAction:'test',sources:[],evidence:[]}]}));const result=await validatePlugin(temp);assert.equal(result.status,'FAIL');assert.ok(result.errors.some(e=>e.includes('proof/approval')));}));
test('Duplicate reuse identities cannot silently replace a prior decision',()=>fixture(async temp=>{await pluginFixture(temp);const record={id:'same',classification:'game-specific',responsibility:'An authored game responsibility',alternatives:[],consumers:[{game:'sample'}],decision:'keep-game-specific',reason:'test',nextAction:'test',sources:[],evidence:[]};await writeFile(path.join(temp,'.agent/reuse-candidates.json'),JSON.stringify({schemaVersion:1,records:[record,record]}));assert.equal((await validatePlugin(temp)).status,'FAIL');}));
