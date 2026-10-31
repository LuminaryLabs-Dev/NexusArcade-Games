#!/usr/bin/env node
import { readFile, writeFile, mkdir, readdir, realpath, rename, open, unlink, stat } from 'node:fs/promises';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { inspectGame } from './scripts/inspect-game.mjs';

export const NAME='nexus-arcade-builder-kit';
export const PLUGIN='.agent/plugins/'+NAME;
export const STAGES=['inspect','plan','implement','verify','quality','register','complete'];
export const QUALITY=['clarity','agency','feedback','challenge','recovery','coherence','accessibility'];
const sha=b=>createHash('sha256').update(b).digest('hex');
const slug=s=>typeof s==='string'&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s);
const readJSON=async p=>JSON.parse(await readFile(p,'utf8'));
async function atomic(file,data){await mkdir(path.dirname(file),{recursive:true});const tmp=file+'.'+randomUUID()+'.tmp';await writeFile(tmp,JSON.stringify(data,null,2)+'\n');await rename(tmp,file);}
export async function treeHash(root){
 const rows=[];let bytes=0;
 async function walk(dir,prefix=''){
  for(const e of (await readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
   if(['node_modules','.git','output'].includes(e.name))continue;
   if(e.isSymbolicLink())throw Error('Symlinks are not valid evidence inputs.');
   const rel=path.join(prefix,e.name),full=path.join(dir,e.name);
   if(e.isDirectory())await walk(full,rel);else if(e.isFile()){
    const data=await readFile(full);bytes+=data.length;if(bytes>100*1024*1024)throw Error('Evidence input exceeds100MiB budget.');rows.push([rel,sha(data)]);
   }
  }
 }
 await walk(root);return sha(JSON.stringify(rows));
}
function git(root,args){return execFileSync('git',['-C',root,...args],{encoding:'utf8',maxBuffer:4*1024*1024}).trim();}
async function within(root,relative){
 if(typeof relative!=='string'||!relative||path.isAbsolute(relative)||relative.split(/[\\/]/).includes('..'))throw Error('Unsafe evidence path.');
 const full=await realpath(path.join(root,relative));if(!full.startsWith(root+path.sep))throw Error('Evidence escaped repository.');return full;
}
async function evidence(root,paths){
 if(!Array.isArray(paths)||!paths.length)throw Error('Specific evidence files are required.');
 const result=[];for(const rel of paths){const file=await within(root,rel);if(!(await stat(file)).isFile())throw Error('Evidence must be a file.');const b=await readFile(file);if(!b.length)throw Error('Empty evidence.');result.push({path:rel,sha256:sha(b),bytes:b.length});}return result;
}
export async function bootstrap(repo,home,codex='codex'){
 repo=await realpath(repo);home=path.resolve(home);await mkdir(home,{recursive:true});
 const manifest=await readJSON(path.join(repo,PLUGIN,'plugin.json'));
 if(manifest.name!==NAME)throw Error('Wrong plugin identity.');
 const env={...process.env,CODEX_HOME:home};
 const call=args=>JSON.parse(execFileSync(codex,args,{cwd:repo,env,encoding:'utf8',maxBuffer:4*1024*1024}));
 call(['plugin','marketplace','add',repo,'--json']);
 const install=call(['plugin','add',NAME+'@nexus-arcade-repo','--json']);
 const listed=call(['plugin','list','--marketplace','nexus-arcade-repo','--json']);
 const entry=listed.installed?.find(x=>x.name===NAME&&x.enabled===true&&x.installed===true);
 if(!entry||entry.source?.path!==path.join(repo,PLUGIN)||!install.installedPath)throw Error('Native Codex did not confirm installation and enablement.');
 const sourceDigest=await treeHash(path.join(repo,PLUGIN));
 if(await treeHash(install.installedPath)!==sourceDigest)throw Error('Installed plugin bytes differ; refresh the package before continuing.');
 const receipt={schemaVersion:1,kind:'native-codex-plugin-installation',name:NAME,version:manifest.version,sourceDigest,codex,codexHome:home,installedPath:install.installedPath,installed:true,enabled:true,sessionInvocation:'NOT RUN',observedAt:new Date().toISOString()};
 await atomic(path.join(repo,'.agent/runtime/arcade-builder/plugin-load.json'),receipt);return receipt;
}
async function verifyLoad(repo){
 const receipt=await readJSON(path.join(repo,'.agent/runtime/arcade-builder/plugin-load.json'));
 if(receipt.name!==NAME||receipt.kind!=='native-codex-plugin-installation'||!receipt.enabled||!receipt.installed)throw Error('Run bootstrap in this executor first.');
 const digest=await treeHash(path.join(repo,PLUGIN));
 if(receipt.sourceDigest!==digest||await treeHash(receipt.installedPath)!==digest)throw Error('Plugin changed since loading; bootstrap again.');
 const output=JSON.parse(execFileSync(receipt.codex,['plugin','list','--marketplace','nexus-arcade-repo','--json'],{cwd:repo,env:{...process.env,CODEX_HOME:receipt.codexHome},encoding:'utf8',maxBuffer:4*1024*1024}));
 if(!output.installed?.some(x=>x.name===NAME&&x.installed===true&&x.enabled===true))throw Error('Plugin is not enabled in this executor.');return receipt;
}
export async function engineInventory(root){
 root=await realpath(root);const commit=git(root,['rev-parse','HEAD']);
 if(git(root,['status','--porcelain','--','src','package.json']))throw Error('Engine source is dirty; establish an explicit source baseline first.');
 const pkg=await readJSON(path.join(root,'package.json'));
 return {root,commit,package:pkg.name,version:pkg.version,exports:pkg.exports||{},readFirst:['AGENTS.md','.agent/development.md'],evidenceBoundary:'Source inventory, not proof that every exported capability works.'};
}
export function newState({repo,engine,game,run,intent,config,plugin}){
 if(!slug(game)||!slug(run)||typeof intent!=='string'||intent.trim().length<20)throw Error('Game, run and substantive full intent are required.');
 if(config.maxCycles!==undefined&&(!Number.isSafeInteger(config.maxCycles)||config.maxCycles<1||config.maxCycles>100))throw Error('maxCycles must be1–100.');
 if(!Array.isArray(config.commands)||!config.commands.length)throw Error('Provide explicitly reviewed validation commands.');
 for(const c of config.commands)if(!c||!['node','npm'].includes(c.command)||!Array.isArray(c.args)||c.args.some(a=>typeof a!=='string'))throw Error('Commands must be reviewed node/npm argument arrays; shell strings are unsupported.');
 if(!config.authorityReference||config.allowImplementation!==true)throw Error('Explicit implementation authority reference required.');
 return {schemaVersion:1,repo,engineRoot:engine.root,engineCommit:engine.commit,game,run,intent,intentHash:sha(intent),config,pluginHash:plugin.sourceDigest,stage:'inspect',status:'active',cycle:1,revision:0,history:[],artifacts:{},nextAction:'Inspect actual Nexus Engine source and map the game requirements.'};
}
async function initRunUnlocked(repo,engineRoot,game,run,intentFile,configFile){
 repo=await realpath(repo);const plugin=await verifyLoad(repo),engine=await engineInventory(engineRoot);
 const activeFile=path.join(repo,'.agent/runtime/arcade-builder/active.json');
 try{const a=await readJSON(activeFile);if(!['complete','cancelled'].includes(a.status))throw Error('Another builder run owns this repository: '+a.run);}catch(e){if(e.code!=='ENOENT')throw e;}
 const state=newState({repo,engine,game,run,intent:await readFile(intentFile,'utf8'),config:await readJSON(configFile),plugin});
 const dir=path.join(repo,'.agent/runs',run);await mkdir(dir,{recursive:true});
 const fd=await open(path.join(dir,'builder-state.json'),'wx');await fd.writeFile(JSON.stringify(state,null,2)+'\n');await fd.close();
 await atomic(path.join(dir,'engine-inventory.json'),engine);await atomic(activeFile,{run,status:'active'});return state;
}
export async function initRun(repo,engineRoot,game,run,intentFile,configFile){
 repo=await realpath(repo);const runtime=path.join(repo,'.agent/runtime/arcade-builder');await mkdir(runtime,{recursive:true});
 const lock=path.join(runtime,'init.lock'),fd=await open(lock,'wx');
 try{return await initRunUnlocked(repo,engineRoot,game,run,intentFile,configFile);}finally{await fd.close();await unlink(lock);}
}
export async function candidateDigest(state){
 const report=await inspectGame(state.repo,state.game);
 if(!report.sourceBuildIdentical)throw Error('Source/build byte mismatch.');
 return sha(JSON.stringify(report.files));
}
export function nextRequest(state){
 return {schemaVersion:1,plugin:NAME,stage:state.stage,cycle:state.cycle,repo:state.repo,engineRoot:state.engineRoot,engineCommit:state.engineCommit,game:state.game,intent:state.intent,authorityReference:state.config.authorityReference,allowedPaths:state.config.allowedPaths||[`games/${state.game}/`,`tests/${state.game}.test.mjs`],artifacts:state.artifacts,previousFindings:state.history.filter(x=>x.result==='fail').slice(-3),instructions:{
 inspect:'Read the installed plugin and actual Engine source. Return status:complete, engineCommit and a nonempty mapping array of responsibility/owner/source/decision/evidence. Do not implement yet.',
 plan:'Preserve the whole intent. Map each game subsystem to verified Core or Kit exports, or game-specific ownership. Return status:complete, engineCommit and nonempty steps plus acceptance criteria. Do not invent APIs or change Core without separate authority.',
 implement:'Implement the scoped game and tests using the approved mapping. Preserve existing features. Return status:complete and evidencePaths for actual changed source. Do not register, publish, or alter unrelated products.',
 verify:'The CLI executes the explicitly configured checks and records their actual exit codes. A missing runtime is blocked, not a pass.',
 quality:'Review the exact candidate using current test and visual evidence. Return status:pass/fail/blocked, artifactDigest, engineCommit, kind:inferred-human-factors, criteria for clarity/agency/feedback/challenge/recovery/coherence/accessibility. Each criterion needs verdict, observation and evidencePaths. List blockingFindings and remediations. Actual human playtesting is a separate field. On failure returnTo must be inspect or plan. Never infer test execution or human enjoyment from code alone.',
 register:'Only the explicitly authorized registry/Website scope may be executed. Recheck the quality-bound artifact and register its immutable files, preserve unrelated releases, verify the remote commit and actual install/play path when required. Return status:complete, commit, branch, evidencePaths and install/launch/close verdicts. Otherwise return blocked with the exact missing action.',
 complete:'Stop. The requested delivery is verified; no additional games or recurring work are authorized.'
 }[state.stage]};
}
function retry(state,reason,returnTo='plan'){
 state.history.push({stage:state.stage,cycle:state.cycle,result:'fail',reason,returnTo});state.cycle++;state.stage=returnTo;state.artifacts=returnTo==='plan'&&state.artifacts.inspection?{inspection:state.artifacts.inspection}:{};
 if(state.cycle>(state.config.maxCycles??5)){state.status='budget-exhausted';state.nextAction='Continue the same run only with an explicit larger execution budget.';}else{state.status='active';state.nextAction='Repair the recorded findings; preserve the full intent.';}
}
export async function acceptReport(state,report){
 if(state.intentHash!==sha(state.intent))throw Error('Original intent changed unexpectedly.');
 if(!report||typeof report!=='object')throw Error('Structured stage result required.');
 if(report.status==='blocked'){state.status='blocked';state.nextAction=String(report.reason||'Missing prerequisite');state.history.push({stage:state.stage,result:'blocked',reason:state.nextAction});return state;}
 const engine=await engineInventory(state.engineRoot);
 if(engine.commit!==state.engineCommit){state.engineCommit=engine.commit;retry(state,'Engine pin changed; invalidate downstream evidence.','inspect');return state;}
 if(state.stage==='inspect'){
  if(report.status!=='complete'||report.engineCommit!==state.engineCommit||!Array.isArray(report.mapping)||!report.mapping.length)throw Error('Inspection must identify the actual Engine pin and mapping.');
  for(const row of report.mapping){
    if(!row.responsibility||!['core-existing','kit-existing','arcade-candidate','game-specific'].includes(row.owner)||!row.source||!row.decision)throw Error('Incomplete capability mapping.');
    const match=/^(engine|repo):(.+)$/.exec(row.source);if(!match)throw Error('Mapping sources must use engine: or repo: paths.');
    await within(match[1]==='engine'?state.engineRoot:state.repo,match[2]);
    if(row.owner==='core-existing'&&(!row.packageExport||!(row.packageExport in engine.exports)))throw Error('Core mapping has no actual public export.');
  }
  state.artifacts.inspection=report;state.stage='plan';
 }else if(state.stage==='plan'){
  if(report.status!=='complete'||report.engineCommit!==state.engineCommit||!report.steps?.length||!report.acceptance?.length)throw Error('Concrete plan and acceptance criteria required.');
  if(report.requiresCoreChanges&&!state.config.allowCoreChanges){state.status='blocked';state.nextAction='Core changes require separate explicit scope.';return state;}
  state.artifacts.plan=report;state.stage='implement';
 }else if(state.stage==='implement'){
  if(report.status!=='complete')return retry(state,report.reason||'Implementation incomplete.','plan'),state;
  state.artifacts.implementation={...report,evidence:await evidence(state.repo,report.evidencePaths)};state.stage='verify';
 }else if(state.stage==='quality'){
  const digest=await candidateDigest(state);
  if(state.artifacts.verification?.status!=='pass')throw Error('Passing executable verification is required.');
  if(digest!==state.artifacts.verification?.artifactDigest||report.artifactDigest!==digest){retry(state,'Candidate changed after verification.','plan');return state;}
  if(report.engineCommit!==state.engineCommit||report.kind!=='inferred-human-factors')throw Error('Review must identify pin and distinguish inference from human testing.');
  if(!Array.isArray(report.blockingFindings))throw Error('Explicit blocking findings list required.');
  const failures=[];
  for(const name of QUALITY){const c=report.criteria?.[name];if(!c||!['pass','fail','blocked'].includes(c.verdict)||!c.observation)throw Error('Missing quality criterion '+name);await evidence(state.repo,c.evidencePaths);if(c.verdict!=='pass')failures.push(name);}
  if(state.config.requireHumanPlaytest&&report.humanPlaytest?.verdict!=='pass'){state.status='blocked';state.nextAction='Actual human playtest evidence is required by this run.';return state;}
  if(report.humanPlaytest?.verdict==='pass')await evidence(state.repo,report.humanPlaytest.evidencePaths);
  if(state.config.requireVisualEvidence!==false){const all=Object.values(report.criteria).flatMap(c=>c.evidencePaths||[]);if(!all.some(p=>/\.(png|jpe?g|webp|webm|mp4)$/i.test(p)))throw Error('Visual/interaction capture is required; source text alone is insufficient.');}
  if(failures.length||report.blockingFindings.length||report.status!=='pass'){
   if(!['inspect','plan'].includes(report.returnTo)||!report.remediations?.length)throw Error('Failed review needs specific fixes and returnTo inspect/plan.');
   retry(state,{failures,findings:report.blockingFindings,remediations:report.remediations},report.returnTo);return state;
  }
  state.artifacts.quality={...report,reviewedDigest:digest};state.stage='register';
  if(!state.config.allowRegistration){state.status='awaiting-approval';state.nextAction='Quality passed; registration is not authorized for this run.';return state;}
 }else if(state.stage==='register'){
  if(!state.config.allowRegistration||!state.artifacts.quality)throw Error('Registration requires explicit authority and a passing quality gate.');
  if(await candidateDigest(state)!==state.artifacts.quality.reviewedDigest){retry(state,'Payload changed after quality review.','plan');return state;}
  if(report.status!=='complete'||!/^[a-f0-9]{40}$/.test(report.commit||'')||report.branch!==(state.config.branch||'main'))throw Error('Verified registration commit and approved branch required.');
  const remote=git(state.repo,['ls-remote','origin','refs/heads/'+report.branch]).split(/\s/)[0];if(remote!==report.commit)throw Error('Remote head does not match the claimed registration commit.');
  if(state.config.requireWebsiteInstall!==false&&![report.installed,report.launched,report.closed].every(x=>x===true))throw Error('Install, launch and close evidence is required.');
  state.artifacts.registration={...report,evidence:await evidence(state.repo,report.evidencePaths)};state.stage='complete';state.status='complete';state.nextAction='Requested delivery complete; retain evidence and stop.';
 }else throw Error('This stage does not accept a worker report.');
 if(state.status==='active')state.nextAction={plan:'Complete the source-grounded game plan.',implement:'Implement the approved game scope.',verify:'Run the configured executable checks.',quality:'Review the verified candidate and interaction evidence.',register:'Complete only the authorized registry and delivery scope.'}[state.stage]||state.nextAction;
 state.revision++;state.history.push({stage:state.stage,result:'advanced',cycle:state.cycle});return state;
}
export async function verifyCandidate(state){
 if(state.stage!=='verify')throw Error('Verification is out of order.');
 const digest=await candidateDigest(state), results=[];
 const dir=path.join(state.repo,'.agent/runs',state.run);await mkdir(dir,{recursive:true});
 for(const [i,c] of state.config.commands.entries()){
  const r=spawnSync(c.command,c.args,{cwd:state.repo,encoding:'utf8',timeout:c.timeoutMs??300000,maxBuffer:4*1024*1024,shell:false});
  const log=`cycle-${state.cycle}-check-${i}.log`;await writeFile(path.join(dir,log),(r.stdout||'')+'\n'+(r.stderr||'')+'\n'+(r.error?.message||''));
  results.push({command:c.command,args:c.args,exitCode:r.status,evidencePath:`.agent/runs/${state.run}/${log}`});
  if(r.error){state.status='blocked';state.nextAction=r.error.message;state.artifacts.verification={results,artifactDigest:digest,status:'blocked'};return state;}
  if(r.status!==0){retry(state,{message:'Executable checks failed',results},'plan');return state;}
 }
 if(await candidateDigest(state)!==digest)throw Error('Validation changed payload bytes; rebuild and verify the new candidate.');
 state.artifacts.verification={status:'pass',results,artifactDigest:digest};state.stage='quality';state.nextAction='Review the verified candidate and interaction evidence.';state.revision++;return state;
}
function parse(argv){const command=argv.shift(),o={};const keys=new Set(['--repo','--home','--codex','--engine','--game','--run','--intent','--config','--worker','--report','--max-cycles','--approval']);for(let i=0;i<argv.length;i+=2){if(!keys.has(argv[i])||o[argv[i].slice(2)]||!argv[i+1]||argv[i+1].startsWith('--'))throw Error('Options require values.');o[argv[i].slice(2)]=argv[i+1];}return {command,o};}
async function locked(repo,run,fn){
 if(!slug(run))throw Error('Safe run ID required.');const dir=path.join(repo,'.agent/runs',run),lock=path.join(dir,'builder.lock');const fd=await open(lock,'wx');
 try{return await fn(dir);}finally{await fd.close();await unlink(lock);}
}
async function save(state,dir){await atomic(path.join(dir,'builder-state.json'),state);await atomic(path.join(state.repo,'.agent/runtime/arcade-builder/active.json'),{run:state.run,status:state.status});}
async function dirtySnapshot(repo){
 const paths=new Set([...git(repo,['diff','--name-only','HEAD']).split('\n'),...git(repo,['ls-files','--others','--exclude-standard']).split('\n')].filter(Boolean));
 const out={};for(const rel of paths){try{out[rel]=sha(await readFile(await within(repo,rel)));}catch(e){if(e.code==='ENOENT')out[rel]=null;else throw e;}}return out;
}
function scopeViolations(before,after,state){
 const allowed=state.config.allowedPaths||[`games/${state.game}/`,`tests/${state.game}.test.mjs`];
 return [...new Set([...Object.keys(before),...Object.keys(after)])].filter(p=>before[p]!==after[p]&&!allowed.some(a=>p===a||p.startsWith(a.endsWith('/')?a:a+'/'))&&!p.startsWith(`.agent/runs/${state.run}/evidence/`)&&!new RegExp(`^\\.agent/runs/${state.run}/cycle-[0-9]+-[a-z-]+-result\\.json$`).test(p));
}
export async function main(argv){
 const {command,o}=parse([...argv]);if(command==='help'||!command){console.log('Commands: bootstrap --repo R --home H [--codex PATH]; init --repo R --engine E --game G --run ID --intent FILE --config FILE; next/status --repo R --run ID; submit --repo R --run ID --report FILE; run --repo R --run ID [--worker FILE]; resume --repo R --run ID [--max-cycles N]; authorize --repo R --run ID --approval FILE; cancel --repo R --run ID. See references/cli.md.');return;}
 if(!o.repo)throw Error('--repo is required.');const repo=await realpath(o.repo);
 if(command==='bootstrap'){if(!o.home)throw Error('Choose an explicit sandbox Codex home.');console.log(JSON.stringify(await bootstrap(repo,o.home,o.codex||'codex'),null,2));return;}
 if(command==='init'){console.log(JSON.stringify(await initRun(repo,o.engine,o.game,o.run,o.intent,o.config),null,2));return;}
 if(!slug(o.run))throw Error('--run is required.');const file=path.join(repo,'.agent/runs',o.run,'builder-state.json');
 if(['status','next'].includes(command)){const s=await readJSON(file);console.log(JSON.stringify(command==='next'?nextRequest(s):s,null,2));return;}
 await locked(repo,o.run,async dir=>{
  let state=await readJSON(file);if(state.repo!==repo)throw Error('Run belongs to another repository.');
  const owner=await readJSON(path.join(repo,'.agent/runtime/arcade-builder/active.json'));if(owner.run!==o.run)throw Error('Another run owns this repository; do not overwrite its state.');
  if(command==='cancel'){state.status='cancelled';state.nextAction='Cancelled explicitly; preserve evidence.';await save(state,dir);return;}
  if(command==='resume'){if(state.status==='complete'||state.status==='cancelled')throw Error('Closed run cannot resume.');if(state.status==='budget-exhausted'){const budget=Number(o['max-cycles']);if(!Number.isSafeInteger(budget)||budget<state.cycle||budget>100)throw Error('Explicit larger --max-cycles budget required.');state.config.maxCycles=budget;}if(state.status==='awaiting-approval')throw Error('Use authorize with the specific user approval, not resume.');state.status='active';await save(state,dir);return;}
  await verifyLoad(repo);
  if(command==='authorize'){
    if(state.stage!=='register'||!state.artifacts.quality)throw Error('Only a quality-cleared registration can be authorized.');
    const approval=await readJSON(o.approval);
    if(approval.allowRegistration!==true||typeof approval.authorityReference!=='string'||!approval.authorityReference.trim())throw Error('Specific registration authority reference required.');
    state.config.allowRegistration=true;state.config.registrationAuthorityReference=approval.authorityReference;state.status='active';await save(state,dir);return;
  }
  if(command==='submit'){if(state.status!=='active')throw Error('Resume the blocked run explicitly first.');state=await acceptReport(state,await readJSON(o.report));await save(state,dir);console.log(JSON.stringify(state,null,2));return;}
  if(command!=='run')throw Error('Unknown command.');
  const worker=o.worker?await realpath(o.worker):path.join(repo,PLUGIN,'scripts/codex-worker.mjs');
  while(state.status==='active'&&state.stage!=='complete'){
   if(state.stage==='verify')state=await verifyCandidate(state);
   else{
    const request=nextRequest(state);request.outputDirectory=dir;request.pluginReceipt=await verifyLoad(repo);
    const before=await dirtySnapshot(repo);
    const controlHash=sha(await readFile(file));
    const result=spawnSync(process.execPath,[worker],{cwd:repo,input:JSON.stringify(request),encoding:'utf8',timeout:state.config.workerTimeoutMs??1800000,maxBuffer:4*1024*1024,shell:false});
    const violations=scopeViolations(before,await dirtySnapshot(repo),state);
    if(controlHash!==sha(await readFile(file))) violations.push('builder-state.json modified by worker');
    if(violations.length){state.status='blocked';state.nextAction='Worker changed files outside its authorized scope: '+violations.join(', ');}
    else if(result.error||result.status!==0){state.status='blocked';state.nextAction='Worker failed: '+(result.error?.message||result.stderr||'exit '+result.status);}
    else {try{state=await acceptReport(state,JSON.parse(result.stdout));}catch(e){state.status='blocked';state.nextAction='Invalid or stale worker evidence: '+e.message;}}
   }
   await save(state,dir);console.log(JSON.stringify({run:state.run,stage:state.stage,status:state.status,cycle:state.cycle,nextAction:state.nextAction}));
  }
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main(process.argv.slice(2)).catch(e=>{console.error(e.message);process.exitCode=1;});
