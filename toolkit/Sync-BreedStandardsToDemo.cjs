// Run from web-admin: node ../toolkit/Sync-BreedStandardsToDemo.cjs [--apply]
// Copies reference standards only; credentials stay in each checkout's local environment.
const fs=require('node:fs');const path=require('node:path');const {parseEnv}=require('node:util');const {createRequire}=require('node:module');
const appRequire=createRequire(path.join(process.cwd(),'package.json'));const {createClient}=appRequire('@supabase/supabase-js');
const columns='id,geneticname,breedid,age,dayfeedperbird,targetweight,note,is_active';
function connect(dir,ref){let env={};for(const file of ['.env','.env.development','.env.local','.env.development.local']){const p=path.join(dir,file);if(fs.existsSync(p))Object.assign(env,parseEnv(fs.readFileSync(p,'utf8')));}if(new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname!==ref+'.supabase.co')throw Error('Unexpected database project');return createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.SUPABASE_SECRET_KEY?.trim()||env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});}
async function read(db){let rows=[];for(let offset=0;;){const r=await db.from('stdbreedspec').select(columns).order('id').range(offset,offset+499);if(r.error)throw Error(r.error.message);rows.push(...r.data);offset+=r.data.length;if(!r.data.length)return rows;}}
const key=r=>[r.geneticname.trim().toLowerCase(),r.breedid.trim().toLowerCase(),r.age].join('|');
const payload=({id,...r})=>r;
function index(rows){const map=new Map();for(const row of rows){if(map.has(key(row)))throw Error('Duplicate breed/sex/age standard: '+key(row));map.set(key(row),row);}return map;}
(async()=>{
 const production=connect('C:/dev/FlockTrax-Production-Release/web-admin','frneaccbbrijpolcesjm');
 const demo=connect('C:/dev/FlockTrax-Demo-Hosted/web-admin','srkgobayrzidytmvoago');
 const [source,before]=await Promise.all([read(production),read(demo)]);const sourceMap=index(source),beforeMap=index(before);
 const inserts=source.filter(r=>!beforeMap.has(key(r)));const updates=source.filter(r=>beforeMap.has(key(r))&&JSON.stringify(payload(r))!==JSON.stringify(payload(beforeMap.get(key(r)))));
 console.log(JSON.stringify({productionRows:source.length,demoRows:before.length,inserts:inserts.length,updates:updates.length,preservedDemoOnly:before.filter(r=>!sourceMap.has(key(r))).length}));
 if(!process.argv.includes('--apply'))return;
 const out=path.resolve('../output/breed-standards-sync-'+new Date().toISOString().replace(/[:.]/g,'-'));fs.mkdirSync(out,{recursive:true});
 fs.writeFileSync(path.join(out,'production-standards.json'),JSON.stringify(source,null,2));fs.writeFileSync(path.join(out,'demo-before.json'),JSON.stringify(before,null,2));
 if(inserts.length){const r=await demo.from('stdbreedspec').insert(inserts.map(payload));if(r.error)throw Error(r.error.message);}
 for(const row of updates){const r=await demo.from('stdbreedspec').update(payload(row)).eq('id',beforeMap.get(key(row)).id);if(r.error)throw Error(r.error.message);}
 const after=await read(demo),afterMap=index(after);
 for(const row of source){if(JSON.stringify(payload(afterMap.get(key(row))||{}))!==JSON.stringify(payload(row)))throw Error('Verification failed for '+key(row));}
 for(const row of before.filter(r=>!sourceMap.has(key(r)))){if(JSON.stringify(afterMap.get(key(row)))!==JSON.stringify(row))throw Error('Demo-only standard changed');}
 fs.writeFileSync(path.join(out,'demo-after.json'),JSON.stringify(after,null,2));
 console.log(JSON.stringify({result:'PASS',verifiedProductionStandards:source.length,demoRows:after.length,backupDirectory:out}));
})().catch(e=>{console.error(e.message);process.exitCode=1});
