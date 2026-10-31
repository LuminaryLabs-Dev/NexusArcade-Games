import path from 'node:path';
import { readFile, readdir, realpath, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export function args(argv) {
  const result = {};
  for(let i=0;i<argv.length;i+=2){
    if(!['--repo','--game'].includes(argv[i]) || !argv[i+1] || argv[i+1].startsWith('--')) throw new Error('Use --repo <repository> --game <slug>.');
    if(result[argv[i]]) throw new Error(`Repeated argument ${argv[i]}`);
    result[argv[i]]=argv[i+1];
  }
  return result;
}
export async function contained(root, relative) {
  if(typeof relative!=='string'||path.isAbsolute(relative)||relative.split(/[\\/]/).includes('..'))throw new Error(`Unsafe relative path: ${relative}`);
  const target=await realpath(path.join(root,relative));
  if(target!==root&&!target.startsWith(root+path.sep))throw new Error(`Path leaves repository: ${relative}`);
  return target;
}
async function inventory(root, relative) {
  const start=await contained(root,relative), result=[];let total=0;
  async function visit(dir, prefix='') {
    for(const e of await readdir(dir,{withFileTypes:true})) {
      const local=path.join(prefix,e.name), full=await contained(root,path.join(relative,local));
      if(e.isSymbolicLink())throw new Error(`Symlink payload is not supported: ${local}`);
      if(e.isDirectory()) await visit(full,local);
      else if(e.isFile()){
        const size=(await stat(full)).size;total+=size;
        if(size>8*1024*1024||total>100*1024*1024||result.length>=5000)throw new Error('Payload exceeds bounded inspection budget.');
        const bytes=await readFile(full);result.push({path:local.split(path.sep).join('/'),bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
      }
    }
  }
  await visit(start);return result.sort((a,b)=>a.path.localeCompare(b.path));
}
export async function inspectGame(repository, slug) {
  if(!repository||!slug||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))throw new Error('Explicit repository and safe game slug required.');
  const root=await realpath(repository);
  const metadata=JSON.parse(await readFile(await contained(root,`games/${slug}/install/game.json`),'utf8'));
  if(metadata.slug!==slug||!/^NXA-\d{6}$/.test(metadata.id))throw new Error('Game identity is invalid.');
  const source=await inventory(root,`games/${slug}/source`), build=await inventory(root,`games/${slug}/build`);
  if(!build.some(f=>f.path==='index.html'))throw new Error('Missing build/index.html.');
  return {schemaVersion:1,game:slug,id:metadata.id,status:metadata.status,registryPending:metadata.registryPending===true,sourceBuildIdentical:JSON.stringify(source)===JSON.stringify(build),sourceFiles:source.length,buildFiles:build.length,payloadBytes:build.reduce((n,f)=>n+f.bytes,0),files:build,scope:'Structural inspection only; gameplay, browser and acceptance are not assessed.'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 try{const a=args(process.argv.slice(2));console.log(JSON.stringify(await inspectGame(a['--repo'],a['--game']),null,2));}
 catch(e){console.error(e.message);process.exitCode=1;}
}
