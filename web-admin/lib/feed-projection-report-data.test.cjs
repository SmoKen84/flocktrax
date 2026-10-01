const assert = require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {test}=require('node:test');
const ts=require('typescript');
const source=readFileSync(`${__dirname}/feed-projection-report-data.ts`,'utf8')+'\nexport { buildFeedProjection };';
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}});
const exportsObject={};
new Function('exports','require',compiled.outputText)(exportsObject,()=>({}));
const build=exportsObject.buildFeedProjection;
const breeds=new Map([['f',{breed_name:'Ross308',sex:'female'}],['m',{breed_name:'Ross308',sex:'male'}]]);
const specs=Array.from({length:70},(_,i)=>i+1).flatMap(age=>['female','male'].map(breedid=>({geneticname:'Ross308',breedid,age,dayfeedperbird:0.1})));
const base={today:'2026-09-30',windowDays:10,ageDays:-6,currentFemaleCount:100,currentMaleCount:100,projectedFemaleMortalityPerDay:0,projectedMaleMortalityPerDay:0,breedFemales:'f',breedMales:'m',breedById:breeds,breedSpecRows:specs,liveHaulEvents:[]};

test('October 7 arrival has zero demand October 1–6 and starts at age 1 on arrival',()=>{
 const p=build(base);
 assert.deepEqual(p.problems,[]);
 assert.equal(p.total,80);
 assert.deepEqual(p.daily.slice(0,6).map(d=>[d.totalFeed,d.totalBirds]),Array(6).fill([0,0]));
 assert.deepEqual(p.daily.slice(6).map(d=>[d.date,d.ageDays,d.totalFeed]),[['2026-10-07',1,20],['2026-10-08',2,20],['2026-10-09',3,20],['2026-10-10',4,20]]);
});
test('pre-arrival dates do not consume mortality or require breed assignments',()=>{
 const p=build({...base,ageDays:-20,breedFemales:null,breedMales:null,breedSpecRows:[]});
 assert.equal(p.total,0); assert.deepEqual(p.problems,[]);
 const arrival=build({...base,projectedFemaleMortalityPerDay:1,projectedMaleMortalityPerDay:1});
 assert.equal(arrival.daily[6].totalBirds,198);
});
test('real missing standards remain unavailable and identify the exact age and sex',()=>{
 // Remove both sexes at day 58 because legacy matching can fall back across sex.
 const missing=build({...base,ageDays:56,windowDays:2,breedSpecRows:specs.filter(s=>s.age!==58)});
 assert.equal(missing.total,null);
 assert.equal(missing.problems.length,2);
 assert.ok(missing.problems.every(message=>message.includes('age days 58')));
 assert.equal(build({...base,ageDays:56,windowDays:2}).total,40);
});
test('empty populations do not require standards after final haul',()=>{
 const p=build({...base,ageDays:56,currentFemaleCount:0,currentMaleCount:0,breedSpecRows:[]});
 assert.equal(p.total,0); assert.deepEqual(p.problems,[]);
});

test('final livehaul removes future feed demand without false missing-standard errors',()=>{
 const p=build({...base,ageDays:0,breedSpecRows:specs.filter(s=>s.age===1),liveHaulEvents:[{date:'2026-10-01',targetHead:200,actualHead:null}]});
 assert.equal(p.total,20);assert.deepEqual(p.problems,[]);
 assert.ok(p.daily.slice(1).every(d=>d.totalFeed===0&&d.totalBirds===0));
});
