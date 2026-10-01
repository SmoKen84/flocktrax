// Read-only hosted verification. Run from web-admin with production local environment path.
const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const Module=require('node:module');const {parseEnv}=require('node:util');
const appRequire=Module.createRequire(path.join(process.cwd(),'package.json'));const ts=appRequire('typescript');const {createClient}=appRequire('@supabase/supabase-js');
const envDir='C:/dev/FlockTrax-Production-Release/web-admin';
for(const file of ['.env','.env.development','.env.local','.env.development.local']){const p=path.join(envDir,file);if(fs.existsSync(p))Object.assign(process.env,parseEnv(fs.readFileSync(p,'utf8')));}
assert.equal(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname,'frneaccbbrijpolcesjm.supabase.co');
const resolve=Module._resolveFilename;Module._resolveFilename=function(name,...args){return resolve.call(this,name.startsWith('@/')?path.join(process.cwd(),name.slice(2)):name,...args);};
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText,file);
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SECRET_KEY?.trim()||process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const rpc=db.rpc.bind(db);db.rpc=(name,args,options)=>name==='sync_derived_placement_issues'?Promise.resolve({data:null,error:null}):rpc(name,args,options);
require(path.join(process.cwd(),'lib/supabase/server.ts')).createSupabaseAdminClient=()=>db;
(async()=>{
 const placement=await db.from('placements').select('id,barn_id,flock_id').eq('placement_key','344-W1').single();if(placement.error)throw Error(placement.error.message);
 const flock=await db.from('flocks').select('date_placed').eq('id',placement.data.flock_id).single();if(flock.error)throw Error(flock.error.message);
 const report=await require(path.join(process.cwd(),'lib/feed-projection-report-data.ts')).getFeedProjectionReportData({windowDays:10,barnId:placement.data.barn_id,reportMode:'operational',includeBinSentryOnOrder:true});
 const row=report.rows.find(r=>r.placementId===placement.data.id);assert.ok(row,'Expected placement in report');assert.deepEqual(row.projectionProblems,[]);assert.notEqual(row.totalLbs,null);
 for(const day of row.daily.filter(d=>d.date<flock.data.date_placed))assert.equal(day.pounds,0);
 console.log(JSON.stringify({result:'PASS',placement:row.placementCode,arrival:flock.data.date_placed,totalLbs:row.totalLbs,daily:row.daily,problems:row.projectionProblems}));
})().catch(e=>{console.error(e.message);process.exitCode=1});
