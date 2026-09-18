// Run from web-admin: node --env-file=.env.local scripts/seed-demo-documents.cjs
const ts=require('typescript');
const fs=require('node:fs');
require.extensions['.ts']=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,filename);
const {createClient}=require('@supabase/supabase-js');
const {seedDemoDocuments}=require('../lib/demo-document-seed.ts');
const url=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin;
const key=(process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY||"").trim();
if(!key) throw new Error('Missing demo service credential');
seedDemoDocuments(createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}),url).then(result=>console.log(JSON.stringify(result))).catch(error=>{console.error(error.message);process.exitCode=1;});
