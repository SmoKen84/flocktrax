// export-adalo Edge Function
// Streams a ZIP containing CSVs for all public tables + a README for Adalo
// Assumptions:
// - Uses built-in Supabase env vars
// - Adds synthetic_id for composite PK tables to ease Adalo imports
// - No external deps; uses Web APIs, Deno, and @supabase/supabase-js
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { ZipWriter } from "jsr:@zip-js/zip-js@2.7.48"; // ESM, Deno-compatible
// Minimal CSV escaper
function toCSV(rows) {
    if (!rows || rows.length === 0)
        return "";
    const headers = Object.keys(rows[0]);
    const escape = (v) => {
        if (v === null || v === undefined)
            return "";
        const s = String(v);
        if (/[",\n]/.test(s))
            return '"' + s.replace(/"/g, '""') + '"';
        return s;
    };
    const lines = [
        headers.join(",")
    ];
    for (const r of rows) {
        lines.push(headers.map((h) => escape(r[h])).join(","));
    }
    return lines.join("\n") + "\n";
}
// Build README content
function buildReadme() {
    return `# Adalo Collections Import Guide\n\nImport each CSV as a Collection with the file's header row.\n\nRecommended primary keys:\n- farms: idxfarm\n- barns: synthetic_id (string) — compose of idxfarm-barnid\n- barnsegments: idxbarnsegment\n- flocks: flockid\n- flocksegments: synthetic_id (string) — compose of flockid-idxbarnsegment\n- log_daily: synthetic_id (string)\n- log_weight: id\n- log_mortality: synthetic_id (string)\n- stdbreedspec: id\n- todos: id\n- user_roles: user_id + role (or create a synthetic_id)\n\nRelationships to create in Adalo:\n- barns → farms: many-to-one via barns.idxfarm to farms.idxfarm\n- barnsegments → barns: many-to-one; either match (idxfarm, barnid) or use barns.synthetic_id stored in barnsegments\n- flocks → farms: many-to-one via idxfarm\n- flocks → barnsegments: many-to-one via idxbarnsegment\n- flocksegments → flocks (flockid), and → barnsegments (idxbarnsegment)\n- log_daily, log_weight, log_mortality → flocks (flockid) and → barnsegments (idxbarnsegment)\n\nTip: If Adalo cannot perform composite lookup, store the referenced ID as a text field and link manually in app logic.\n`;
}
// Query helpers that add synthetic IDs where useful
async function fetchAll(supabase) {
    // farms
    const farms = (await supabase.from("farms").select("idxfarm,farmgroup,farmname,addr,city,state,zip,farmcode,last_userid,created_date,last_updated,is_active")).data ?? [];
    // barns with synthetic_id
    const barnsRaw = (await supabase.from("barns").select("idxfarm,barnid")).data ?? [];
    const barns = barnsRaw.map((r) => ({
                ...r,
                synthetic_id: `${r.idxfarm}-${r.barnid}`
            }));
    // barnsegments
    const barnsegments = (await supabase.from("barnsegments").select("idxbarnsegment,idxfarm,barnid,length,width,sqft,stdroc_cap,last_userid,created_date,last_updated,is_active,is_empty,has_flockid")).data ?? [];
    // flocks
    const flocks = (await supabase.from("flocks").select("flockid,idxfarm,dateplaced,cnt_males,cnt_females,proj_firstkill,proj_lastkill,idxbarnsegment,lh_1,lh_2,lh_lastdate,last_userid,created_date,last_updated,is_active")).data ?? [];
    // flocksegments with synthetic_id
    const flocksegmentsRaw = (await supabase.from("flocksegments").select("flockid,idxbarnsegment,ss_tab")).data ?? [];
    const flocksegments = flocksegmentsRaw.map((r) => ({
                ...r,
                synthetic_id: `${r.flockid}-${r.idxbarnsegment}`
            }));
    // log_daily with synthetic_id
    const logDailyRaw = (await supabase.from("log_daily").select("idxdate,flockid,idxbarnsegment,refplacedate,age,amtemp,minvent,settemp,naoh,last_userid,comment,created_date,last_updated,temp_ambien,is_oda_open,oda_exception,is_active")).data ?? [];
    const log_daily = logDailyRaw.map((r) => ({
                ...r,
                synthetic_id: `${r.idxdate}-${r.flockid}-${r.idxbarnsegment}-${r.oda_exception ?? ''}`
            }));
    // log_weight
    const log_weight = (await supabase.from("log_weight").select("id,flockid,idxbarnsegment,weighdate,age,sex,cntweighed,avg,procure,stddev,uniformity,othernote,last_userid,created_date,last_updated,is_active")).data ?? [];
    // log_mortality with synthetic_id
    const logMortalityRaw = (await supabase.from("log_mortality").select("idxdate,flockid,idxbarnsegment,deadmale,deadfemale,cullmale,cullmalenote,cullfemale,cullfemalenote,deadreason,grade_feathers,grade_litter,grade_lame,grade_footpad,grade_pecking,last_userid,created_date,last_updated,is_active")).data ?? [];
    const log_mortality = logMortalityRaw.map((r) => ({
                ...r,
                synthetic_id: `${r.idxdate}-${r.flockid}-${r.idxbarnsegment}`
            }));
    // stdbreedspec
    const stdbreedspec = (await supabase.from("stdbreedspec").select("id,geneticname,breedid,age,dayfeedperbird,targetweight,note,last_userid,created_date,last_updated,is_active")).data ?? [];
    // todos
    const todos = (await supabase.from("todos").select("id,created_at,tasks")).data ?? [];
    // user_roles
    const user_roles = (await supabase.from("user_roles").select("user_id,role,created_at")).data ?? [];
    return {
        farms,
        barns,
        barnsegments,
        flocks,
        flocksegments,
        log_daily,
        log_weight,
        log_mortality,
        stdbreedspec,
        todos,
        user_roles
    };
}
Deno.serve(async(req) => {
    try {
        const url = new URL(req.url);
        if (req.method !== 'GET') {
            return new Response(JSON.stringify({
                    error: 'Use GET'
                }), {
                status: 405,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        }
        // Auth: allow anon key for read-only export; require a Bearer token to respect RLS
        const authHeader = req.headers.get('Authorization') || '';
        const supabase = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_ANON_KEY'), {
            global: {
                headers: authHeader ? {
                    Authorization: authHeader
                }
                 : {}
            }
        });
        const data = await fetchAll(supabase);
        // Prepare ZIP in memory
        const writer = new ZipWriter();
        const addFile = async(path, content) => {
            await writer.add(path, new Blob([
                        content
                    ], {
                    type: 'text/plain;charset=utf-8'
                }));
        };
        // CSV files
        await addFile('data/public/farms.csv', toCSV(data.farms));
        await addFile('data/public/barns.csv', toCSV(data.barns));
        await addFile('data/public/barnsegments.csv', toCSV(data.barnsegments));
        await addFile('data/public/flocks.csv', toCSV(data.flocks));
        await addFile('data/public/flocksegments.csv', toCSV(data.flocksegments));
        await addFile('data/public/log_daily.csv', toCSV(data.log_daily));
        await addFile('data/public/log_weight.csv', toCSV(data.log_weight));
        await addFile('data/public/log_mortality.csv', toCSV(data.log_mortality));
        await addFile('data/public/stdbreedspec.csv', toCSV(data.stdbreedspec));
        await addFile('data/public/todos.csv', toCSV(data.todos));
        await addFile('data/public/user_roles.csv', toCSV(data.user_roles));
        // README
        await addFile('README_adalo.md', buildReadme());
        const zipBlob = await writer.close();
        return new Response(zipBlob, {
            headers: {
                'Content-Type': 'application/zip',
                'Content-Disposition': 'attachment; filename="export-adalo.zip"'
            }
        });
    } catch (e) {
        console.error(e);
        return new Response(JSON.stringify({
                error: String(e)
            }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }
});
