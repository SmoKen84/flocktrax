"use client";
/* eslint-disable @next/next/no-img-element */
import { useRef, useState } from 'react';

import { ArrowRight, ArrowsOut, ClipboardText, FileText, Grains, X, ArrowUpRight } from '@phosphor-icons/react';
type Screen = {name:string; image:string; alt:string; title?:string; text?:string; caption?:string; width?:number; height?:number};
const screens: Screen[] = [
 { name: 'Live dashboard', image: 'admin-overview.png', title: 'The field comes into focus.', text: 'Daily input from FlockTrax-Mobile reaches FlockTrax-Admin, giving farm managers and integrators a shared view of flock activity, open issues and performance.', alt: 'Actual FlockTrax demo dashboard with sidebar navigation and three flock cards' },
 { name: 'Feed planning', image: 'feed-projection.png', title: 'See the feed. Plan the next delivery.', text: 'Bring inventory readings, projected consumption and undelivered orders into the same conversation. Explore when on-hand inventory is projected to run out—and how an expected delivery changes the picture.', alt: 'Actual FlockTrax demo feed projection report' },
 { name: 'Original documents', image: 'documents.png', title: 'The numbers have a paper trail.', text: 'Keep hatch tickets and supporting flock documents in an original-document repository. Retrieve source records while reviewing the flock, from placement through closeout.', alt: 'Actual FlockTrax demo document archive checklist' }
];
const mobileWorkflows: {title:string; text:string; screens:Screen[]}[] = [
 { title: 'Start with the flock.', text: 'See active flocks, bird counts and open issues. Check the operations calendar for placements and livehaul scheduled in Admin.', screens: [
  {name:'Active flocks · iPad',image:'mobile-ipad-dashboard.png',width:2732,height:2048,alt:'Actual iPad active flock dashboard with bird counts and open issues',caption:'Flock status on a larger field display.'},
  {name:'Operations calendar · iPad',image:'mobile-ipad-calendar.png',width:2732,height:2048,alt:'Actual iPad operations calendar with placement and livehaul views',caption:'See the schedule while you’re in the field.'}
 ]},
 { title: 'Follow every feed delivery.', text: 'Find a feed ticket, review its drops, and allocate pounds to the right bin and flock. A split delivery stays connected to its original ticket.', screens: [
  {name:'Feed tickets',image:'mobile-feed-tickets.png',alt:'Mobile feed ticket search and delivery listing',caption:'Find tickets by number, flock or date.'},
  {name:'Ticket and drops',image:'mobile-feed-drops.png',alt:'Mobile feed ticket review showing 47980 pounds allocated across three bin drops',caption:'Review the total and each allocation.'},
  {name:'Bin allocation',image:'mobile-feed-allocation.png',alt:'Mobile feed drop editor with farm, barn, bin, feed type and pounds',caption:'Record where the feed actually went.'}
 ]},
 { title: 'Keep the day moving.', text: 'Review work orders by barn and category, and check farm weather without losing the context of your field work.', screens: [
  {name:'Farm work orders',image:'mobile-work-orders.png',alt:'Mobile farm work orders with barn and category filters and an open repair',caption:'Keep open work visible to the team.'},
  {name:'Farm weather',image:'mobile-weather.png',alt:'Mobile farm weather popup showing hourly and seven-day forecasts',caption:'Local conditions, right at hand.'}
 ]}
];
const mobileScreens = mobileWorkflows.flatMap(group=>group.screens);
export function MarketingLanding({policyText}: {policyText:string}) {
 const [active,setActive]=useState(0); const [expanded,setExpanded]=useState<Screen | null>(null); const dialog=useRef<HTMLDialogElement>(null); const privacyDialog=useRef<HTMLDialogElement>(null);
 function enlarge(screen: Screen){setExpanded(screen);dialog.current?.showModal();}
 const current=screens[active];
 const mobileIndex=mobileScreens.findIndex(screen=>screen.image===expanded?.image);
 return <div className="marketing">
 <a className="skip" href="#main">Skip to content</a>
 <header className="header"><a className="wordmark" href="#main" aria-label="FlockTrax home">Flock<span>Trax</span><sup>™</sup></a><nav aria-label="Main navigation"><a href="#platform">Platform</a><a href="#mobile">Mobile</a><a href="#story">Our story</a><a href="/login">Sign in</a><a className="button gold nav-cta" href="#contact">See FlockTrax in action <ArrowRight size={19}/></a></nav></header>
 <main id="main">
 <section className="hero"><h1>From barn floor.<br/>To the bigger picture.</h1><p>Connect the people, records and decisions behind every flock cycle.</p><div className="gold-rule"/></section>
 <section className="visual-story" aria-label="From field collection to desktop insight">
 <figure className="barn"><img src="/marketing/media/barn-worker.png" alt="Illustration of a farm worker recording data on a smartphone in a poultry barn"/><figcaption>Record in the barn</figcaption></figure>
 <figure className="mobile"><button onClick={()=>enlarge({image:'mobile-dashboard.png',name:'FlockTrax-Mobile · release screen',alt:'Actual FlockTrax-Mobile dashboard release screenshot'})} aria-label="Enlarge Mobile release screen"><img src="/marketing/media/mobile-dashboard.png" alt="FlockTrax-Mobile release dashboard showing an active flock"/></button><figcaption>FlockTrax-Mobile<small>Mobile release screen</small></figcaption></figure>
 <figure className="admin"><button onClick={()=>enlarge(screens[0])} aria-label="Enlarge FlockTrax-Admin dashboard"><img src="/marketing/media/admin-overview.png" alt={screens[0].alt}/><span className="enlarge"><ArrowsOut size={17}/> View full screen</span></button><figcaption>At your fingertips in FlockTrax-Admin<small>Captured from the FlockTrax demo</small></figcaption></figure>
 </section>
 <section className="benefits section" id="platform"><h2>The details matter.<br/>Keep them together.</h2><p className="intro">FlockTrax brings daily farm activity, feed records, work follow-up and flock history into one connected platform.</p><div className="benefit-grid">
 <article><ClipboardText/><div><h3>Daily flock records</h3><p>Capture what happens each day, right from the people closest to the birds.</p></div></article>
 <article><Grains/><div><h3>Feed planning</h3><p>Connect inventory, deliveries and projections to help your team plan ahead.</p></div></article>
 <article><FileText/><div><h3>Original documents</h3><p>Keep the source paperwork with the flock, ready when a question needs an answer.</p></div></article></div></section>
 <section className="screens section" aria-labelledby="screens-title"><div className="section-heading"><div><p className="eyebrow">Inside the platform</p><h2 id="screens-title">Real Work.  The Real Picture.</h2></div><p>The same interface you’ll explore in the demo.<br/>Select a view, then open it at full size.</p></div><div className="screen-tabs" role="group" aria-label="Choose a product screen">{screens.map((s,i)=><button key={s.name} aria-pressed={active===i} onClick={()=>setActive(i)}>{s.name}</button>)}</div><div className="screen-layout"><div className="screen-copy"><span className="screen-number">0{active+1}</span><h3>{current.title}</h3><p>{current.text}</p><button className="text-button" onClick={()=>enlarge(current)}>Explore the screen <ArrowsOut size={18}/></button><p className="capture-note">Actual demo capture · sample data<br/>Open the original to inspect the details.</p></div><button className="screen-image" onClick={()=>enlarge(current)} aria-label={`Enlarge ${current.name}`}><img src={`/marketing/media/${current.image}`} alt={current.alt} loading="lazy"/></button></div></section>
 <section className="mobile-tour section" id="mobile" aria-labelledby="mobile-title">
  <div className="section-heading"><div><p className="eyebrow">FlockTrax-Mobile</p><h2 id="mobile-title">The work happens here.</h2></div><p>A closer look at the app in your team’s hands.<br/>Seven actual release screens. Tap any to explore.</p></div>
  <p className="mobile-release-note">Screenshot tour · iPhone & iPad release 1.0.5 · Images are illustrative records, not a live mobile demo.</p>
  {mobileWorkflows.map((group,index)=><div className={`mobile-workflow workflow-${index}`} key={group.title}>
   <div className="mobile-workflow-copy"><span className="screen-number">0{index+1}</span><h3>{group.title}</h3><p>{group.text}</p></div>
   <div className={`mobile-screen-grid count-${group.screens.length}`}>{group.screens.map(screen=><figure key={screen.image}>
    <button className="mobile-capture" onClick={()=>enlarge(screen)} aria-label={`Enlarge mobile ${screen.name}`}><img src={`/marketing/media/${screen.image}`} alt={screen.alt} loading="lazy" width={screen.width||1242} height={screen.height||2688}/><span><ArrowsOut size={16}/> Enlarge</span></button>
    <figcaption><h4>{screen.name}</h4><p>{screen.caption}</p></figcaption>
   </figure>)}</div>
  </div>)}
  <div className="mobile-connection"><h3>One database. One live picture.</h3><p>FlockTrax-Mobile saves field data directly to the same database FlockTrax-Admin reads. As soon as a record is saved, it is available to farm managers and integrators—no separate submission, transfer or duplicate entry. The field and the office work from the same live flock record.</p><a className="text-button" href="#screens-title">Explore the Admin screens <ArrowRight size={18}/></a></div>
 </section>
 <section className="story section" id="story"><p className="eyebrow">Built around the work</p><div className="story-grid"><h2>A farm’s perspective.<br/>An operation’s view.</h2><div><p>Developed by Smotherman Farms, Ltd. in West, Texas, FlockTrax connects the work happening in the barn with the decisions happening at the desk.</p><p>Workers collect flock information in Mobile. Managers and integrators review it in Admin. The flock record stays at the center, from daily logs and feed tickets to scheduling, work orders and closeout.</p></div></div><div className="integration"><h3>Connect to the systems<br/>your business already uses.</h3><div><p><strong>Feed-monitoring APIs.</strong> The current BinSentry integration brings feed inventory into FlockTrax. The approach can be adapted to other feed-monitoring providers with suitable APIs.</p><p><strong>Corporate information systems.</strong> The Google Cloud and Sheets sync interface connects flock data with existing information workflows, with scope to adapt connections to other corporate systems.</p></div></div></section>
 <section className="contact section" id="contact"><p className="eyebrow">Let’s look at your operation</p><h2>Your next flock deserves<br/>a clearer picture.</h2><p>See how the field record becomes a working view for your team.</p><a className="button gold" href="mailto:Ken@MotherCluckersHenHouse.com?subject=Show%20me%20FlockTrax">Request a demo <ArrowRight size={20}/></a><div className="contact-details"><strong>Ken Smotherman</strong><a href="mailto:Ken@MotherCluckersHenHouse.com">Ken@MotherCluckersHenHouse.com</a><a href="tel:+12547156101">(254) 715-6101</a></div><a className="demo-link" href="https://flocktrax-demo.vercel.app">Already have demo access? Open the demo <ArrowUpRight size={16}/></a><small className="credentials">Evaluator credentials required.</small></section>
 </main>
 <footer><div><a className="wordmark" href="#main">Flock<span>Trax</span><sup>™</sup></a><p>© {new Date().getFullYear()} Smotherman Farms, Ltd. All rights reserved.<br/>West, Texas, USA</p></div><div><button className="footer-link" onClick={()=>privacyDialog.current?.showModal()}>Privacy policy</button><p>Product images are actual application captures.<br/>Farm photographs are AI-generated.</p></div></footer>
 <dialog className="privacy-dialog" ref={privacyDialog} aria-labelledby="privacy-title" onClick={e=>{if(e.target===privacyDialog.current)privacyDialog.current?.close();}}>
  <div className="dialog-head"><strong id="privacy-title">FlockTrax Privacy Policy</strong><button autoFocus onClick={()=>privacyDialog.current?.close()} aria-label="Close privacy policy"><X size={24}/></button></div>
  <article className="privacy-content">{policyText.trim().split(/\r?\n\r?\n/).slice(1).map((block,i)=><p key={i}>{block}</p>)}</article>
  <div className="privacy-actions"><button className="button gold" onClick={()=>privacyDialog.current?.close()}>Return to presentation</button></div>
 </dialog>
 <dialog ref={dialog} aria-label={expanded?.name||'Product screenshot'} onClick={e=>{if(e.target===dialog.current)dialog.current?.close();}}><div className="dialog-head"><strong>{expanded?.name}</strong><div>{expanded&&<a href={`/marketing/media/${expanded.image}`} target="_blank" rel="noreferrer">Open original <ArrowUpRight size={16}/></a>}<button onClick={()=>dialog.current?.close()} aria-label="Close screenshot"><X size={24}/></button></div></div>{expanded&&<img className="original" src={`/marketing/media/${expanded.image}`} alt={expanded.alt}/>} {mobileIndex>=0&&<div className="mobile-viewer-nav"><button disabled={mobileIndex===0} onClick={()=>setExpanded(mobileScreens[mobileIndex-1])}>Previous</button><span>{mobileIndex+1} / {mobileScreens.length}</span><button disabled={mobileIndex===mobileScreens.length-1} onClick={()=>setExpanded(mobileScreens[mobileIndex+1])}>Next</button></div>}</dialog>
 </div>;
}




