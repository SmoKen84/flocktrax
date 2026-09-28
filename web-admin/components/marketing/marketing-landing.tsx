"use client";
import { DemoRequestForm } from './demo-request-form';
/* eslint-disable @next/next/no-img-element */
import { useRef, useState } from 'react';
import { TechnicalArchitecture } from './technical-architecture';

import { ArrowRight, ArrowsOut, ClipboardText, FileText, Grains, X, ArrowUpRight } from '@phosphor-icons/react';
type Screen = {name:string; image:string; alt:string; title?:string; text?:string; caption?:string; width?:number; height?:number};
const screens: Screen[] = [
 { name: 'Live dashboard', image: 'admin-overview.png', title: 'The barns come into focus.', text: 'Daily input from FlockTrax-Mobile apps saves into the common database that FlockTrax-Admin reads. The Live Dashboard displays real-time farm data as it is collected. Managers and integrators have a shared view of flock activity, repair work orders and performance factors.', alt: 'Actual FlockTrax demo dashboard with sidebar navigation and three flock cards' },
 { name: 'Feed planning', image: 'feed-projection.png', title: 'See the feed. Plan the next delivery.', text: 'Bring inventory readings, projected consumption and undelivered orders into the same conversation. Explore when on-hand inventory is projected to run out—and how an expected delivery changes the picture.', alt: 'Actual FlockTrax demo feed projection report' },
 { name: 'Original documents', image: 'documents.png', title: 'The numbers have a paper trail.', text: 'Keep hatch tickets and supporting flock documents in an original-document repository. Retrieve source records while reviewing the flock, from placement through closeout.', alt: 'Actual FlockTrax demo document archive checklist' }
];
const mobileWorkflows: {title:string; text:string; screens:Screen[]}[] = [
 { title: 'Start with the flock.', text: 'See active flocks, bird counts and open issues. Check the operations calendar for placements and livehaul scheduled in Admin.', screens: [
  {name:'Active flocks · iPad',image:'mobile-ipad-dashboard.png',width:2732,height:2048,alt:'Actual iPad active flock dashboard with bird counts and open issues',caption:'Flock status on a larger field display.'},
  {name:'Operations calendar · iPad',image:'mobile-ipad-calendar.png',width:2732,height:2048,alt:'Actual iPad operations calendar with placement and livehaul views',caption:'See the schedule while you’re in the field.'}
 ]},
 { title: 'Follow every feed delivery.', text: 'Feed deliveries are entered and allocated to the bins receiving feed. FlockTrax maintains the accounting by crediting the delivery to the correct flock. Feed transfers and pickups are handled by flock managers through FlockTrax-Admin. Store feed ticket documents along with the entry for auditing.', screens: [
  {name:'Feed tickets',image:'mobile-feed-tickets.png',alt:'Mobile feed ticket search and delivery listing',caption:'Find tickets by number, flock or date.'},
  {name:'Ticket and drops',image:'mobile-feed-drops.png',alt:'Mobile feed ticket review showing 47980 pounds allocated across three bin drops',caption:'Review the total and each allocation.'},
  {name:'Bin allocation',image:'mobile-feed-allocation.png',alt:'Mobile feed drop editor with farm, barn, bin, feed type and pounds',caption:'Record where the feed actually went.'}
 ]},
 { title: 'Work Orders - Trace from Discovery to Completion', text: 'As barns are checked, workers can record items that need repair or inspection. These Work Orders can later be retrieved and/or updated easily by any team member.', screens: [
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
 <header className="header"><a className="wordmark" href="#main" aria-label="FlockTrax home"><img className="brand-bird" src="/marketing/media/flocktrax-bird-original.svg" alt=""/>Flock<span>Trax</span><sup>™</sup></a><nav aria-label="Main navigation"><a href="#platform">Platform</a><a href="#mobile">Mobile</a><a href="#story">Our story</a><a href="/login">Sign in</a><a className="button gold nav-cta" href="#contact">See FlockTrax in action <ArrowRight size={19}/></a></nav></header>
 <main id="main">
 <section className="hero"><h1>From barn floor.<br/>To the bigger picture.</h1><p>Completely scalable flock management. From a single farm grower needing insight to an integrator collecting daily flock data from multiple growers, FlockTrax-Mobile &amp; FlockTrax-Admin will bring your picture into focus.</p><div className="gold-rule"/></section>
 <section className="visual-story" aria-label="From field collection to desktop insight">
 <figure className="barn"><img src="/marketing/media/barn-worker.png" alt="Illustration of a farm worker recording data on a smartphone in a poultry barn"/><figcaption>Record in the barn</figcaption></figure>
 <figure className="mobile"><button onClick={()=>enlarge({image:'mobile-dashboard.png',name:'FlockTrax-Mobile · release screen',alt:'Actual FlockTrax-Mobile dashboard release screenshot'})} aria-label="Enlarge Mobile release screen"><img src="/marketing/media/mobile-dashboard.png" alt="FlockTrax-Mobile release dashboard showing an active flock"/></button><figcaption>FlockTrax-Mobile</figcaption></figure>
 <div className="hero-screen-gap" aria-hidden="true"/><figure className="admin"><button onClick={()=>enlarge(screens[0])} aria-label="Enlarge FlockTrax-Admin dashboard"><img src="/marketing/media/admin-overview.png" alt={screens[0].alt}/><span className="enlarge"><ArrowsOut size={17}/> View full screen</span></button><figcaption>At your fingertips in FlockTrax-Admin</figcaption></figure>
 </section>
 <section className="benefits section" id="platform"><h2>The details matter.<br/>Keep them together.</h2><p className="intro">FlockTrax brings daily farm activity, feed records, work follow-up and flock history into one connected platform.</p><div className="benefit-grid">
 <article><ClipboardText/><div><h3>Daily flock records</h3><p>Capture what happens each day, right from the people closest to the birds.</p></div></article>
 <article><Grains/><div><h3>Feed planning</h3><p>Feed inventory by barn &amp; flock. Reconcile deliveries. Feed required projections for 10, 14, 21 &amp; 28 days in the future.</p></div></article>
 <article><FileText/><div><h3>Original documents</h3><p>An original document archive included with every flock. Store original hatch tickets, feed deliveries, livehaul records &amp; more.</p></div></article></div></section>
 <section className="screens section" aria-labelledby="screens-title"><div className="section-heading"><div><p className="eyebrow">Inside the platform</p><h2 id="screens-title">Real Work.  The Real Picture.</h2></div><p>Select a view, then open it at full size.</p></div><div className="screen-tabs" role="group" aria-label="Choose a product screen">{screens.map((s,i)=><button key={s.name} aria-pressed={active===i} onClick={()=>setActive(i)}>{s.name}</button>)}</div><div className="screen-layout"><div className="screen-copy"><span className="screen-number">0{active+1}</span><h3>{current.title}</h3><p>{current.text}</p><button className="text-button" onClick={()=>enlarge(current)}>Explore the screen <ArrowsOut size={18}/></button><p className="capture-note">Open the original to inspect the details.</p></div><button className="screen-image" onClick={()=>enlarge(current)} aria-label={`Enlarge ${current.name}`}><img src={`/marketing/media/${current.image}`} alt={current.alt} loading="lazy"/></button></div></section>
 <section className="mobile-tour section" id="mobile" aria-labelledby="mobile-title">
  <div className="section-heading"><div><p className="eyebrow">FlockTrax-Mobile</p><h2 id="mobile-title">The work happens here.</h2></div><p>Multiple workers can use FlockTrax-Mobile to contribute to the daily input from the farms &amp; barns.</p></div>
  <p className="mobile-release-note">Available on the App Store for iPhones &amp; iPads (iOS versions) and on Google Play Store for Android smart phones &amp; tablets.</p>
  {mobileWorkflows.map((group,index)=><div className={`mobile-workflow workflow-${index}`} key={group.title}>
   <div className="mobile-workflow-copy"><span className="screen-number">0{index+1}</span><h3>{index===2?<><span className="work-order-title">Work Orders</span><span className="work-order-subtitle">Trace from Discovery to Completion</span></>:group.title}</h3><p>{group.text}</p></div>
   <div className={`mobile-screen-grid count-${group.screens.length}`}>{group.screens.map(screen=><figure key={screen.image}>
    <button className="mobile-capture" onClick={()=>enlarge(screen)} aria-label={`Enlarge mobile ${screen.name}`}><img src={`/marketing/media/${screen.image}`} alt={screen.alt} loading="lazy" width={screen.width||1242} height={screen.height||2688}/><span><ArrowsOut size={16}/> Enlarge</span></button>
    <figcaption><h4>{screen.name}</h4><p>{screen.caption}</p></figcaption>
   </figure>)}</div>
  </div>)}
  <details className="mobile-connection"><summary><span className="technical-summary-lines"><span>Want to know more...?</span><span><span className="wordmark">Flock<span>Trax</span><sup>™</sup></span> Technical Layout</span></span></summary><TechnicalArchitecture/></details>
 </section>
 <section className="story section" id="story"><p className="eyebrow">Built around the work</p><div className="story-grid"><h2>A farm’s perspective.<br/>An operation’s view.</h2><div><p>Developed by Smotherman Farms, Ltd. in West, Texas, FlockTrax connects the work happening in the barn with the decisions happening at the desk.</p><p>Workers collect flock information with the Mobile app. Managers review it in Admin. The flock record stays focused at the center, from daily environmental readings and mortality, flock health through grading assessments and feed deliveries to scheduling, work orders and summarizing with a closeout procedure. Once settlement has been received, then saving the completed flock into permanent history.</p></div></div><div className="integration"><div className="integration-accent"><h3>Connect to the systems<br/>your business already uses.</h3><button className="screen-image integration-chart" onClick={()=>enlarge({image:'binsentry-chart.png',name:'BinSentry feed monitoring',alt:'BinSentry feed levels for three bins with a historical barn inventory chart'})} aria-label="Enlarge BinSentry feed monitoring chart"><img src="/marketing/media/binsentry-chart.png" width="714" height="476" alt="BinSentry feed levels for three bins with a historical barn inventory chart" loading="lazy"/></button></div><div><p>Compatible data APIs may be developed to supply information for FlockTrax.</p><p>BinSentry Bin Monitoring has been incorporated using BinSentryAPI to provide barn inventory, new order recording and notifications of delivery, as well as verifying actual historical delivery drops. This comprehensive API module allows FlockTrax to calculate feed projections for ordering and much more.</p><p>Virtually any third-party software package that has published API documentation should be able to contribute to FlockTrax.</p></div></div></section>
 <section className="contact section" id="contact"><div className="request-title-block"><img className="request-bird" src="/marketing/media/flocktrax-bird-original.svg" alt="FlockTrax bird"/><div><p className="eyebrow">Let’s look at your operation</p><h2>Your next flock deserves<br/>a clearer picture.</h2></div></div><p>See how the field record becomes a working view for your team.</p><DemoRequestForm/><div className="contact-details"><strong>Ken Smotherman</strong><a href="mailto:ken@FlockTrax.com">ken@FlockTrax.com</a><a href="tel:+12547156101">(254) 715-6101</a></div><a className="demo-link" href="https://flocktrax-demo.vercel.app">Already have demo access? Open the demo <ArrowUpRight size={16}/></a><small className="credentials">Evaluator credentials required.</small></section>
 </main>
 <footer><div><a className="wordmark" href="#main"><img className="brand-bird" src="/marketing/media/flocktrax-bird-original.svg" alt=""/>Flock<span>Trax</span><sup>™</sup></a><p>© {new Date().getFullYear()} Smotherman Farms, Ltd. All rights reserved.<br/>West, Texas, USA</p></div><div><button className="footer-link" onClick={()=>privacyDialog.current?.showModal()}>Privacy policy</button><p>Farm photographs are AI-generated.</p></div></footer>
 <dialog className="privacy-dialog" ref={privacyDialog} aria-labelledby="privacy-title" onClick={e=>{if(e.target===privacyDialog.current)privacyDialog.current?.close();}}>
  <div className="dialog-head"><strong id="privacy-title">FlockTrax Privacy Policy</strong><button autoFocus onClick={()=>privacyDialog.current?.close()} aria-label="Close privacy policy"><X size={24}/></button></div>
  <article className="privacy-content">{policyText.trim().split(/\r?\n\r?\n/).slice(1).map((block,i)=><p key={i}>{block}</p>)}</article>
  <div className="privacy-actions"><button className="button gold" onClick={()=>privacyDialog.current?.close()}>Return to presentation</button></div>
 </dialog>
 <dialog ref={dialog} aria-label={expanded?.name||'Product screenshot'} onClick={e=>{if(e.target===dialog.current)dialog.current?.close();}}><div className="dialog-head"><strong>{expanded?.name}</strong><div>{expanded&&<a href={`/marketing/media/${expanded.image}`} target="_blank" rel="noreferrer">Open original <ArrowUpRight size={16}/></a>}<button onClick={()=>dialog.current?.close()} aria-label="Close screenshot"><X size={24}/></button></div></div>{expanded&&<img className="original" src={`/marketing/media/${expanded.image}`} alt={expanded.alt}/>} {mobileIndex>=0&&<div className="mobile-viewer-nav"><button disabled={mobileIndex===0} onClick={()=>setExpanded(mobileScreens[mobileIndex-1])}>Previous</button><span>{mobileIndex+1} / {mobileScreens.length}</span><button disabled={mobileIndex===mobileScreens.length-1} onClick={()=>setExpanded(mobileScreens[mobileIndex+1])}>Next</button></div>}</dialog>
 </div>;
}




