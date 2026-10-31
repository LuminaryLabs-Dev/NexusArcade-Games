import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
const base='games/switchyard';
async function files(dir,prefix=''){let result=[];for(const e of await readdir(dir,{withFileTypes:true})){const rel=path.join(prefix,e.name);if(e.isDirectory())result.push(...await files(path.join(dir,e.name),rel));else result.push(rel);}return result.sort();}
test('Switchyard permanent ID is unique across every repository game',async()=>{
 const ids=new Set();for(const e of await readdir('games',{withFileTypes:true})){
  if(!e.isDirectory()||e.name.startsWith('_'))continue;
  const m=JSON.parse(await readFile(`games/${e.name}/install/game.json`));assert.ok(!ids.has(m.id),`duplicate ${m.id}`);ids.add(m.id);
 } assert.ok(ids.has('NXA-000017'));
 const m=JSON.parse(await readFile(`${base}/install/game.json`));assert.equal(m.registryPending,true);assert.equal(m.status,'prototype');
});
test('Switchyard source and packaged payload have identical bytes and local module imports',async()=>{
 const names=await files(`${base}/source`);assert.deepEqual(await files(`${base}/build`),names);
 for(const file of names){
  const a=await readFile(`${base}/source/${file}`),b=await readFile(`${base}/build/${file}`);assert.deepEqual(a,b,file);
  if(file.endsWith('.mjs')&&!file.startsWith('vendor/'))for(const match of a.toString().matchAll(/from\s+['"]([^'"]+)['"]/g)){
   assert.ok(match[1].startsWith('.'),`non-local import ${file}`);await readFile(path.resolve(base,'build',path.dirname(file),match[1]));
  }
 }
});
test('Pinned Engine bundle matches its recorded content hash and license',async()=>{
 const p=JSON.parse(await readFile(`${base}/source/vendor/provenance.json`));const bytes=await readFile(`${base}/source/vendor/nexusengine.mjs`);
 assert.equal(p.commit,'4906076837d4020ff2e22fe98723e0922ea6af62');assert.equal(p.bytes,bytes.length);assert.equal(p.sha256,createHash('sha256').update(bytes).digest('hex'));
 assert.match(await readFile(`${base}/source/vendor/NexusEngine-LICENSE.txt`,'utf8'),/MIT License/);
});
