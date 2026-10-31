import path from 'node:path';
import { readFile, readdir, realpath } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { args, contained } from './inspect-game.mjs';
const classifications=new Set(['core-existing','kit-existing','arcade-candidate','game-specific']);
const decisions=new Set(['reuse-existing','defer','keep-game-specific','extract-approved']);
const names=['nexus-arcade-builder-it','arcade-convert-it','arcade-reuse-audit-it','arcade-validate-it','arcade-integrate-it','arcade-load-it','arcade-plan-it','arcade-build-it','arcade-quality-it','arcade-register-it'];
export async function validatePlugin(repository){
 const root=await realpath(repository), errors=[];
 const check=(condition,message)=>{if(!condition)errors.push(message);};
 const json=async rel=>JSON.parse(await readFile(await contained(root,rel),'utf8'));
 const plugin='.agent/plugins/nexus-arcade-builder-kit';
 const manifest=await json(`${plugin}/plugin.json`);
 check(manifest.$schema==='https://agent-plugins.org/schemas/1.0.0/plugin.schema.json','Unsupported plugin schema.');
 check(manifest.name==='nexus-arcade-builder-kit','Plugin identity mismatch.');
 check(/^\d+\.\d+\.\d+$/.test(manifest.version||''),'Missing semantic version.');
 check(typeof manifest.description==='string'&&manifest.description.length>10,'Missing description.');
 check(!manifest.mcpServers&&!manifest.hooks&&!manifest.extensions?.['com.openai']?.hooks,'This skills-only package must not enable undeclared servers/hooks.');
 const compatibility=await json(`${plugin}/.codex-plugin/plugin.json`);
 check(compatibility.name===manifest.name&&compatibility.version===manifest.version,'Codex compatibility manifest differs.');
 await contained(root,`${plugin}/cli.mjs`);
 const market=await json('.agents/plugins/marketplace.json');
 check(market.name==='nexus-arcade-repo','Marketplace identity mismatch.');
 const matches=(market.plugins||[]).filter(x=>x.name===manifest.name);check(matches.length===1,'Exactly one marketplace entry required.');
 const entry=matches[0];
 check(entry?.source?.source==='local'&&entry?.source?.path==='./.agent/plugins/nexus-arcade-builder-kit','Marketplace path must target the plugin within this repo.');
 check(entry?.policy?.installation==='AVAILABLE'&&entry?.policy?.authentication==='ON_INSTALL','Unexpected install/auth policy.');
 check(entry?.category==='Productivity','Missing marketplace category.');
 const actual=(await readdir(await contained(root,`${plugin}/skills`),{withFileTypes:true})).filter(e=>e.isDirectory()).map(e=>e.name).sort();
 check(JSON.stringify(actual)===JSON.stringify([...names].sort()),'Skill package is missing or adds an unintended workflow.');
 for(const name of names){
  const rel=`${plugin}/skills/${name}/SKILL.md`, text=await readFile(await contained(root,rel),'utf8');
  check(text.startsWith('---\n')&&text.includes(`\nname: ${name}\n`)&&/\ndescription: .+/.test(text),`Invalid skill frontmatter: ${name}`);
  for(const match of text.matchAll(/\.\.\/\.\.\/references\/([a-z-]+\.md)/g))await contained(root,`${plugin}/references/${match[1]}`);
 }
 for(const rel of ['AGENTS.md','.agent/development.md','kits/README.md',`${plugin}/scripts/inspect-game.mjs`,`${plugin}/scripts/validate-plugin.mjs`])await contained(root,rel);
 const catalogue=await json('.agent/reuse-candidates.json');check(catalogue.schemaVersion===1&&Array.isArray(catalogue.records),'Invalid reuse registry.');
 const seen=new Set();
 for(const r of catalogue.records||[]){
  check(typeof r.id==='string'&&/^[a-z0-9-]+$/.test(r.id)&&!seen.has(r.id),`Duplicate/invalid reuse ID: ${r.id}`);seen.add(r.id);
  check(classifications.has(r.classification),`Invalid classification: ${r.id}`);check(decisions.has(r.decision),`Invalid decision: ${r.id}`);
  check(typeof r.responsibility==='string'&&r.responsibility.length>10&&typeof r.reason==='string'&&typeof r.nextAction==='string',`Incomplete decision: ${r.id}`);
  check(Array.isArray(r.alternatives)&&Array.isArray(r.consumers)&&r.consumers.length>0,`Missing comparison: ${r.id}`);
  for(const rel of [...(r.sources||[]),...(r.evidence||[])])await contained(root,rel);
  if(r.decision==='extract-approved'){
   check(r.classification==='arcade-candidate',`Extraction has wrong owner: ${r.id}`);
   check(new Set((r.consumers||[]).map(c=>c.game)).size>=2&&typeof r.approvalReference==='string'&&r.runtimeParityEvidence?.length>0,`Extraction lacks consumer proof/approval: ${r.id}`);
   for(const rel of r.runtimeParityEvidence||[])await contained(root,rel);
  }
 }
 return {schemaVersion:1,status:errors.length?'FAIL':'PASS',plugin:manifest.name,skills:names.length,reuseRecords:seen.size,errors,scope:'Repository package validation, not client installation or behavioral skill evaluation.'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 try{const a=args(process.argv.slice(2));if(!a['--repo']||a['--game'])throw new Error('Use --repo <repository>.');const report=await validatePlugin(a['--repo']);console.log(JSON.stringify(report,null,2));if(report.status!=='PASS')process.exitCode=1;}
 catch(e){console.error(e.message);process.exitCode=1;}
}
