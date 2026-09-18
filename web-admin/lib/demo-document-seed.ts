import { createHash } from "node:crypto";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEMO_DOCUMENT_TEMPLATE } from "./demo-document-template";

const PROJECT = "srkgobayrzidytmvoago";
const OWNER = "ac1ee85e-7ed3-4ee0-adc2-59d5fea0b12a";
const BUCKET = "flocktrax-document-archive";
type Sample = { role: string; parent: string; id: string; title: string; rows: Array<[string,string]> };
const num = (value: unknown) => Number(value || 0).toLocaleString("en-US", {maximumFractionDigits:2});
const date = (value: unknown) => String(value || "Not recorded").slice(0,10);
function uuid(key: string) {
 const h=createHash("md5").update(key).digest("hex");
 return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}
export async function renderDemoDocument(sample: Sample) {
 const doc=await PDFDocument.load(Buffer.from(DEMO_DOCUMENT_TEMPLATE,"base64"));
 const page=doc.getPages()[0];
 const font=await doc.embedFont(StandardFonts.Helvetica);
 const bold=await doc.embedFont(StandardFonts.HelveticaBold);
 const safe=(s:string)=>s.replace(/[^\x20-\x7e]/g,"-");
 page.drawText(safe(sample.title),{x:42,y:640,size:19,font:bold,color:rgb(.14,.24,.21)});
 let y=605;
 for(const [label,value] of sample.rows) {
  page.drawText(safe(label),{x:42,y,size:10,font:bold,color:rgb(.30,.37,.33)});
  const words=safe(value).split(/\s+/);const lines:string[]=[];let line="";
  for(const word of words) { const next=line ? line+" "+word : word; if(font.widthOfTextAtSize(next,11)>340 && line){lines.push(line);line=word;}else line=next; }
  lines.push(line);
  for(const text of lines){page.drawText(text,{x:220,y,size:11,font,color:rgb(.12,.17,.14)});y-=15;}
  y-=15;
  if(y<95) throw new Error("Sample document exceeds its checked one-page layout.");
 }
 doc.setTitle(`DEMO / SAMPLE - ${sample.title}`);
 doc.setAuthor("FlockTrax Demo - fictional records");
 return Buffer.from(await doc.save());
}

// Called after the guarded demo reset and by the owner maintenance script.
export async function seedDemoDocuments(admin: SupabaseClient, projectUrl: string) {
 if(new URL(projectUrl).hostname !== `${PROJECT}.supabase.co`) throw new Error("Demo document seed refused outside the demo project.");
 const status=await admin.rpc("get_demo_showcase_status");
 if(status.error || status.data?.project_ref!==PROJECT) throw new Error("Could not verify demo project marker.");
 const tables=["feed_tickets","feed_drops","placements","flocks","farms","barns","livehaul_schedule","livehaul_loads","placement_closeouts","document_archives"] as const;
 const results=await Promise.all(tables.map(table=>admin.from(table).select("*")));
 for(let i=0;i<results.length;i++) if(results[i].error) throw new Error(`Cannot load ${tables[i]} for demo documents: ${results[i].error!.message}`);
 const [tickets,drops,placements,flocks,farms,barns,hauls,loads,closeouts,existing]=results.map(r=>r.data??[]);
 const place=(id:string)=>placements.find(p=>p.id===id);
 const flock=(p:any)=>flocks.find(f=>f.id===p?.flock_id);
 const location=(p:any)=>`${farms.find(f=>f.id===p?.farm_id)?.farm_name??"Demo farm"} / ${barns.find(b=>b.id===p?.barn_id)?.barn_code??"Barn"}`;
 const samples:Sample[]=[];
 for(const t of tickets.filter(t=>String(t.ticket_num).startsWith("DEMO-"))) {
  const td=drops.filter(d=>d.feed_ticket_id===t.id);
  samples.push({role:"feed_ticket_original",parent:"feed_ticket_id",id:t.id,title:"Feed Delivery Ticket",rows:[
   ["Ticket reference",t.ticket_num],["Delivery date",date(t.delivery_date)],["Feed mill",t.feedmill || "Evergreen Feed Mill"],
   ["Feed type",t.feed_name],["Net delivered",`${num(t.feed_weight)} lb`],
   ...td.map((d):[string,string]=>["Bin allocation",`${location(d)} / ${d.bin_code} - ${num(d.drop_weight)} lb`]),
   ["Receipt","Fictional delivery record; no real carrier or recipient signature."]
  ]});
 }
 const showcase=placements.filter(p=>String(p.id).startsWith("de500000-") || closeouts.some(c=>c.placement_id===p.id && String(c.notes).startsWith("DEMO:")));
 for(const p of showcase.filter(p=>!['scheduled','unassigned','canceled'].includes(p.lifecycle_stage))) {
  const f=flock(p); if(!f) continue;
  samples.push({role:"hatch_ticket",parent:"placement_id",id:p.id,title:"Hatchery Delivery Ticket",rows:[
   ["Hatchery","Evergreen Demo Hatchery"],["Flock / placement",`${f.flock_number} / ${p.placement_key}`],["Destination",location(p)],
   ["Female arrival",date(f.female_date_placed||f.date_placed)],["Female chicks",num(f.start_cnt_females)],
   ["Male arrival",date(f.male_date_placed||f.date_placed)],["Male chicks",num(f.start_cnt_males)],
   ["Total chicks",num(Number(f.start_cnt_females||0)+Number(f.start_cnt_males||0))],
   ["Receipt","Fictional count acknowledgment. No real hatchery certificate or signature."]
  ]});
 }
 for(const h of hauls.filter(h=>h.status==='completed' && showcase.some(p=>p.id===h.placement_id))) {
  const p=place(h.placement_id);
  samples.push({role:"bill_of_lading",parent:"livehaul_schedule_id",id:h.livehaul_id,title:"Livehaul Bill of Lading",rows:[
   ["Flock / placement",`${flock(p)?.flock_number} / ${p?.placement_key}`],["Origin",location(p)],["Destination","Evergreen Demo Processing Plant"],
   ["Pickup date",date(h.actual_date||h.lh_date)],["Birds transported",num(h.head_actual)],
   ["Loads",num(loads.filter(l=>l.livehaul_id===h.livehaul_id).length)],["Carrier","Fictional demonstration carrier - no real shipment."]
  ]});
  for(const l of loads.filter(l=>l.livehaul_id===h.livehaul_id)) samples.push({role:"scale_ticket",parent:"livehaul_load_id",id:l.load_id,title:"Livehaul Scale Ticket",rows:[
   ["Flock / placement",`${flock(p)?.flock_number} / ${p?.placement_key}`],["Weighed date",date(h.actual_date||h.lh_date)],
   ["Scale",l.scale_location||"Demo scale"],["Truck / trailer",`${l.truck_num} / ${l.trailer_num}`],["Gross weight",`${num(l.scale_loaded)} lb`],
   ["Tare weight",`${num(l.scale_empty)} lb`],["Net live weight",`${num(l.live_weight)} lb`],["Bird count",num(l.head_count)],
   ["Dead on arrival",num(l.doa_count)],["Certification","Fictional sample; not a certified scale receipt."]
  ]});
 }
 for(const c of closeouts.filter(c=>String(c.notes).startsWith("DEMO:"))) {
  const p=place(c.placement_id);const identity:[string,string][]=[["Flock / placement",`${flock(p)?.flock_number} / ${p?.placement_key}`],["Farm / barn",location(p)]];
  samples.push({role:"closeout_sheet_snapshot",parent:"placement_closeout_id",id:c.placement_id,title:"Closeout Worksheet Snapshot",rows:[...identity,
   ["Removed date",date(p?.date_removed)],["Processed birds",num(c.processed_head_final)],["Final live weight",`${num(c.live_weight_final)} lb`],
   ["Feed delivered / consumed",`${num(c.feed_delivered_total_lbs)} / ${num(c.feed_consumed_total_lbs)} lb`],
   ["Starter / Grower",`${num(c.starter_consumed_lbs)} / ${num(c.grower_consumed_lbs)} lb`],["Remaining feed credit",`${num(c.feed_remaining_credit_lbs)} lb`],
   ["Feed conversion",Number(c.feed_conversion).toFixed(4)],["Workflow stage",c.status.replaceAll('_',' ')],["Next step",c.status==='submitted'?'Record settlement when received.':'Review and complete final closeout.']
  ]});
  const amount=Number(c.live_weight_final)*.065;
  samples.push({role:"misc_document",parent:"placement_closeout_id",id:c.placement_id,title:"Grower Service Invoice",rows:[...identity,
   ["Invoice",`DEMO-INV-${flock(p)?.flock_number}`],["Invoice date",date(c.invoice_created_at)],["Basis",`${num(c.live_weight_final)} lb at fictional $0.065 / lb`],
   ["Sample service total",`$${amount.toFixed(2)}`],["Status","Supporting invoice for demo closeout. Not payable."]
  ]});
  if(c.settlement_received_at) samples.push({role:"misc_document",parent:"placement_closeout_id",id:c.placement_id,title:"Settlement Statement",rows:[...identity,
   ["Statement",`DEMO-SET-${flock(p)?.flock_number}`],["Received date",date(c.settlement_received_at)],["Service invoice",`DEMO-INV-${flock(p)?.flock_number}`],
   ["Sample settlement",`$${amount.toFixed(2)}`],["Payment","Simulated receipt only. No funds transferred."],["Next step","Final closeout remains open for evaluator practice."]
  ]});
 }
 let created=0;
 for(const sample of samples) {
  const id=uuid(`demo-document:${sample.role}:${sample.id}:${sample.title}`);
  if(existing.some(d=>d.is_current && d[sample.parent]===sample.id && d.document_role===sample.role && (sample.role!=="misc_document" || d.id===id))) continue;
  const bytes=await renderDemoDocument(sample);
  const path=`demo-showcase/${id}.pdf`;
  const uploaded=await admin.storage.from(BUCKET).upload(path,bytes,{contentType:"application/pdf",upsert:true});
  if(uploaded.error) throw new Error(`Sample PDF upload failed: ${uploaded.error.message}`);
  const saved=await admin.from("document_archives").upsert({id,document_role:sample.role,[sample.parent]:sample.id,storage_bucket:BUCKET,storage_path:path,
   original_filename:`DEMO-${sample.title.replaceAll(' ','-')}-${sample.id.slice(0,8)}.pdf`,mime_type:"application/pdf",byte_size:bytes.length,
   sha256:createHash("sha256").update(bytes).digest("hex"),source_kind:"backfill_import",notes:`${sample.title}\nDEMO / SAMPLE - fictional supporting document.`,is_current:true,created_by:OWNER},{onConflict:"id"});
  if(saved.error) throw new Error(`Sample document registration failed: ${saved.error.message}`);
  created++;
 }
 return {created,expected:samples.length};
}
