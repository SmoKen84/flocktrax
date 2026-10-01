// Read-only RPC checks; run from web-admin with environment directory and expected project ref.
const fs = require('node:fs');
const path = require('node:path');
const { parseEnv } = require('node:util');
const { createRequire } = require('node:module');
const assert = require('node:assert/strict');
const appRequire = createRequire(path.join(process.cwd(), 'package.json'));
const { createClient } = appRequire('@supabase/supabase-js');
const [dir, ref] = process.argv.slice(2);
const env = {};
for (const name of ['.env', '.env.development', '.env.local', '.env.development.local']) {
  const file = path.join(dir, name);
  if (fs.existsSync(file)) Object.assign(env, parseEnv(fs.readFileSync(file, 'utf8')));
}
assert.equal(new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname, `${ref}.supabase.co`);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY);
async function checked(query) { const r = await query; if (r.error) throw Error(r.error.message); return r.data; }
(async () => {
  const placements = await checked(db.from('placements').select('id,farm_id,placement_key,active_start,lifecycle_stage').eq('lifecycle_stage','canceled'));
  const users = await checked(db.from('user_roles').select('user_id'));
  let reviews = 0;
  for (const p of placements) {
    let actor;
    for (const id of [...new Set(users.map(r => r.user_id))]) {
      if (await checked(db.rpc('can_manage_placement_lifecycle', { p_actor: id, p_farm: p.farm_id }))) { actor = id; break; }
    }
    if (!actor) { console.log(JSON.stringify({ placement: p.placement_key, result: 'No manager with farm membership; access correctly unavailable' })); continue; }
    const r = await checked(db.rpc('preview_placement_reinstatement', { p_placement_id: p.id, p_placement_date: p.active_start, p_actor_id: actor }));
    assert.equal(r.placement.id, p.id);
    assert.ok(r.fingerprint);
    console.log(JSON.stringify({ placement: p.placement_key, emptyBarn: r.empty_barn, moveFeed: r.move_feed, feedDrops: r.drops.length, blocker: r.blocker }));
    reviews++;
  }
  const unauthorized = await db.rpc('can_manage_placement_lifecycle', { p_actor: '00000000-0000-0000-0000-000000000000', p_farm: '00000000-0000-0000-0000-000000000000' });
  assert.equal(unauthorized.error, null);
  assert.equal(unauthorized.data, false);
  console.log(JSON.stringify({ result: 'PASS', canceledPlacements: placements.length, authorizedReviews: reviews, businessRecordsMutated: 0 }));
})().catch(e => { console.error(e.message); process.exitCode = 1; });
