import {build} from 'esbuild';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const pin='447816ea39e89fa7095b7a1ffdf46d8fba7f68cd';
const base=`https://raw.githubusercontent.com/LuminaryLabs-Dev/NexusEngine/${pin}/`;
const packageResponse=await fetch(base+'package.json');if(!packageResponse.ok)throw new Error('Pinned Engine package metadata unavailable');
const pkg=await packageResponse.json();
const map=Object.fromEntries(Object.entries(pkg.exports).filter(([k,v])=>typeof v==='string').map(([k,v])=>[k==='.'?'nexusengine':'nexusengine/'+k.slice(2),new URL(v,base).href]));
map.nexusengine=base+'src/engine.js';map['nexusengine/domains/authoring/contract']=base+'src/core-domains/authoring/kits/authoring-domain-contract-kit/index.js';
let active=0,count=0;const wait=[],sources={};
async function download(url){if(active>=6)await new Promise(r=>wait.push(r));active++;try{const r=await fetch(url);if(!r.ok)throw new Error(`${r.status} ${url}`);const text=await r.text();sources[url]={bytes:Buffer.byteLength(text),sha256:createHash('sha256').update(text).digest('hex')};if(++count%100===0)console.log('Read dependencies',count);return text;}finally{active--;wait.shift()?.();}}
const plugin={name:'pinned-http',setup(b){b.onResolve({filter:/.*/},args=>{const url=map[args.path]??(args.path.startsWith('https:')?args.path:args.path.startsWith('.')?new URL(args.path,args.importer).href:null);if(!url)throw new Error(`Unmapped ${args.path}`);return {path:url,namespace:'http'};});b.onLoad({filter:/.*/,namespace:'http'},async args=>({contents:await download(args.path),loader:'js'}));}};
const entry=`export {createEngine} from 'nexusengine';import {createAuthoringDomainContractKit as a} from 'nexusengine/domains/authoring/contract';import {createAuthoringProjectDocumentKit as p} from 'nexusengine/domains/authoring/project';import {createAuthoringMeshDocumentKit as m} from 'nexusengine/domains/authoring/mesh';export function createAuthoringDomain(){return [a(),p(),m()];}`;
const license=await download(base+'LICENSE');fs.mkdirSync('runtime-dist',{recursive:true});
await build({stdin:{contents:entry,sourcefile:'nexus-arcade-engine-entry.mjs'},plugins:[plugin],bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true,outfile:'runtime-dist/engine-runtime.mjs',banner:{js:`/*! NexusEngine ${pin}; MIT; Copyright (c) 2026 Luminary Labs. See THIRD-PARTY-LICENSES.txt. */`}});
fs.writeFileSync('runtime-dist/THIRD-PARTY-LICENSES.txt',license);
fs.writeFileSync('runtime-dist/engine-sources.json',JSON.stringify({pin,buildTool:'esbuild@0.25.12',sources},null,2));
for(const v of ['0.165.0','0.180.0']){await build({stdin:{contents:`export * from 'https://cdn.jsdelivr.net/npm/three@${v}/build/three.module.js';`},plugins:[plugin],bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true,outfile:`runtime-dist/three-${v}.mjs`,legalComments:'inline'});const r=await fetch(`https://cdn.jsdelivr.net/npm/three@${v}/LICENSE`);if(!r.ok)throw new Error('Three license unavailable');fs.appendFileSync('runtime-dist/THIRD-PARTY-LICENSES.txt',`\nThree.js ${v}\n${await r.text()}`);}
console.log('Runtime bundles built',fs.readdirSync('runtime-dist').map(p=>[p,fs.statSync('runtime-dist/'+p).size]));
