// Verify the seeded objects can be downloaded and match repository hashes.
const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');
const {createClient}=require('@supabase/supabase-js');
const url=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin;
if(url!=='https://srkgobayrzidytmvoago.supabase.co') throw new Error('Demo only');
const admin=createClient(url,(process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY).trim());
(async()=>{
 const {data,error}=await admin.from('document_archives').select('*').like('storage_path','demo-showcase/%').eq('is_current',true);
 if(error) throw error;
 const dir=path.resolve('../output/pdf/demo-repository');fs.mkdirSync(dir,{recursive:true});
 for(const doc of data){
  const r=await admin.storage.from(doc.storage_bucket).download(doc.storage_path);if(r.error) throw r.error;
  const bytes=Buffer.from(await r.data.arrayBuffer());
  if(crypto.createHash('sha256').update(bytes).digest('hex')!==doc.sha256||bytes.length!==doc.byte_size) throw new Error('Document hash/size mismatch');
  fs.writeFileSync(path.join(dir,doc.id+'.pdf'),bytes);
 }
 fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(data.map(d=>({id:d.id,role:d.document_role,name:d.original_filename})),null,2));
 console.log(JSON.stringify({downloaded:data.length,hashesVerified:true,roles:data.reduce((r,d)=>(r[d.document_role]=(r[d.document_role]||0)+1,r),{})}));
})().catch(e=>{console.error(e.message);process.exitCode=1});
