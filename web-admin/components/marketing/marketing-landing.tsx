"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, ArrowsOut, X } from "@phosphor-icons/react";
import { DemoRequestForm } from "./demo-request-form";

type Screen = { image: string; title: string; alt: string };
const media = "/marketing/brochure/";
const screenSizes: Record<string, [number, number]> = {
  "admin-dashboard": [681, 768],
  "mobile-dashboard": [2000, 1499],
  "mobile-calendar": [2000, 1499],
  "feed-tickets": [1017, 2200],
  "feed-drops": [1017, 2200],
  "feed-allocation": [1017, 2200],
  "work-orders": [1017, 2200],
  "document-audit": [747, 568],
  "feed-daily": [1184, 283],
  "feed-order": [1173, 226],
  "binsentry-chart": [715, 476],
};
const screens = {
  admin: { image: "admin-dashboard", title: "FlockTrax-Admin · Live Dashboard", alt: "FlockTrax-Admin barn dashboard with flock status, daily records and feed buttons" },
  dashboard: { image: "mobile-dashboard", title: "FlockTrax-Mobile · Live Dashboard", alt: "Tablet dashboard showing active flocks, bird counts and open issues" },
  calendar: { image: "mobile-calendar", title: "Operations calendar", alt: "Tablet calendar for upcoming placements and livehaul" },
  tickets: { image: "feed-tickets", title: "Find the feed ticket", alt: "Mobile feed ticket search and delivery listing" },
  drops: { image: "feed-drops", title: "Review the delivery", alt: "Mobile feed ticket with 47,980 pounds allocated across three drops" },
  allocation: { image: "feed-allocation", title: "Record the bin drops", alt: "Mobile feed allocation showing the farm, barn, bin and pounds delivered" },
  work: { image: "work-orders", title: "FlockTrax-Mobile · Work Orders", alt: "Mobile work order listing with barn filters and repair details" },
  audit: { image: "document-audit", title: "Flock report · Original documents", alt: "Flock feed report and document archive with underlined links to original tickets and supporting documents" },
  daily: { image: "feed-daily", title: "Feed required each day", alt: "Feed forecast report with expanded daily requirements by barn and feed type" },
  order: { image: "feed-order", title: "Feed to order by type", alt: "Feed projection comparing required feed, on-hand inventory, on-order deliveries and additional feed to order" },
  bins: { image: "binsentry-chart", title: "BinSentry · Feed inventory", alt: "BinSentry bin readings and historical barn inventory chart" },
} satisfies Record<string, Screen>;

const dataGroups = [
  { title: "Barn environment", items: ["AM temperature & set point", "Humidity & ammonia level", "Weather high & low", "Ventilation method", "Pasture access", "Water meter reading", "Comments"] },
  { title: "Mortality", items: ["Male mortality & reasons", "Male culls & reasons", "Female mortality & reasons", "Female culls & reasons", "Comments"] },
  { title: "Grading & health", items: ["Litter", "Footpads", "Feathers", "Leg health", "Pecking"] },
  { title: "Weight sampling", items: ["Date weighed, average & count", "Sex", "Breed specification weight & %", "Standard deviation", "Uniformity & delta"], note: "Multiple samples can be recorded." },
  { title: "Action items", items: ["Barn work orders & maintenance", "Flock health events", "Prescriptions & DVM orders", "Vaccine applications"], note: "Dated updates follow each event through resolution. Multiple records can be added." },
];

export function MarketingLanding({ policyText }: { policyText: string }) {
  const page = useRef<HTMLDivElement>(null);
  const footer = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = footer.current;
    if (!element) return;
    const reserveFooterSpace = () => page.current?.style.setProperty("--footer-height", `${element.getBoundingClientRect().height}px`);
    reserveFooterSpace();
    const observer = new ResizeObserver(reserveFooterSpace);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const [expanded, setExpanded] = useState<Screen | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const privacyDialog = useRef<HTMLDialogElement>(null);
  const layoutDialog = useRef<HTMLDialogElement>(null);
  function enlarge(screen: Screen) { setExpanded(screen); dialog.current?.showModal(); }
  function capture(screen: Screen, className = "") {
    return <figure className={`brochure-capture ${className}`}>
      <button type="button" onClick={() => enlarge(screen)} aria-label={`Enlarge ${screen.title}`}>
        <img src={`${media}${screen.image}.webp`} alt={screen.alt} width={screenSizes[screen.image][0]} height={screenSizes[screen.image][1]} loading="lazy" />
        <span className="capture-enlarge"><ArrowsOut size={16} /> Enlarge</span>
      </button>
      <figcaption>{screen.title}</figcaption>
    </figure>;
  }
  const brand = <><img className="brand-bird" src="/marketing/media/flocktrax-bird-original.svg" alt="" />Flock<span>Trax</span><sup>™</sup></>;

  return <div className="marketing brochure" ref={page}>
    <a className="skip" href="#main">Skip to content</a>
    <header className="header">
      <div className="header-brand"><a className="wordmark" href="#main" aria-label="FlockTrax home">{brand}</a><p className="brand-owner">Smotherman Farms, Ltd.  West, Texas USA</p></div>
      <nav aria-label="Main navigation">
        <a href="#platform">Platform</a><a href="#feed">Feed</a><a href="#documents">Documents</a><a href="#story">Our story</a>
        <a href="/login">Sign in</a><a className="button gold nav-cta" href="#contact">Request a demo <ArrowRight size={18} /></a>
      </nav>
    </header>

    <main id="main">
      <section className="brochure-hero">
        <div className="brochure-hero-copy">
          <p className="eyebrow">Connected flock management</p>
          <h1>From the Barn…<br />To the Big Picture.</h1>
          <p className="hero-lead">One farm seeking insight. An integrator connecting multiple growers. A clearer picture for everyone.</p>
          <p>FlockTrax scales with your operation, connecting daily barn records with the people managing the flock.</p>
          <div className="hero-actions"><a className="button gold" href="#platform">Explore FlockTrax <ArrowRight size={19} /></a><a className="brochure-text-link" href="#contact">See it for your operation <ArrowUpRight size={18} /></a></div>
          <div className="hero-signature"><span>Developed by Smotherman Farms, Ltd.</span><span>West, Texas</span></div>
        </div>
        <figure className="brochure-hero-photo"><img src={`${media}barn.webp`} width="1536" height="1024" alt="Illustration of a grower recording flock information in a poultry barn" fetchPriority="high" /><figcaption>Record in the barn with FlockTrax-Mobile.</figcaption></figure>
      </section>

      <section className="brochure-connection section" aria-labelledby="connection-title">
        <div><p className="eyebrow">FlockTrax · Flock Management System</p><h2 id="connection-title">Two applications.<br />One connected operation.</h2><p>FlockTrax-Mobile collects the daily barn metrics. FlockTrax-Admin turns them into a live working view for your management team.</p><div className="connection-roles"><p><strong>In the barn</strong><span>Simple collection on phones and tablets.</span></p><p><strong>At the desk</strong><span>Schedules, feed, work orders, closeouts and history.</span></p></div></div>
        {capture(screens.admin, "admin-capture")}
      </section>

      <section className="brochure-platform section" id="platform">
        <div className="brochure-section-heading"><p className="eyebrow">One database. Infinite possibilities.</p><h2>Many Inputs…<br />One Picture.</h2><p>Mobile and Admin share the same flock records. Permissions and memberships give each person the view they need, while connected services bring in the surrounding information.</p></div>
        <button type="button" className="text-button" aria-haspopup="dialog" onClick={() => layoutDialog.current?.showModal()}>Explore the technical layout <ArrowUpRight size={20} /></button>
      </section>

      <section className="brochure-mobile section" id="mobile">
        <div className="brochure-split"><div><p className="eyebrow">Collect data where the work happens</p><h2>It Starts Here…</h2><p>The lean mobile app focuses on simple data collection. Each farm and barn is summarized on a live dashboard according to the user’s permissions and system memberships.</p><p>Multiple authenticated workers and flock supervisors can contribute to the daily records. Upcoming placements and livehaul schedules are shared through an operations calendar, keeping everyone informed.</p><p className="brochure-note">FlockTrax-Mobile for iOS and Android phones and tablets.</p></div><img className="brochure-scene" src={`${media}field-work.webp`} width="1536" height="1024" alt="Illustration of a poultry worker recording observations on a tablet beside the flock" loading="lazy" /></div>
        <div className="brochure-tablets">{capture(screens.dashboard)}{capture(screens.calendar)}</div>
        <div className="collected-data"><h3>One daily record. The details that matter.</h3><div className="data-groups">{dataGroups.map(group => <div key={group.title}><h4>{group.title}</h4><ul>{group.items.map(item => <li key={item}>{item}</li>)}</ul>{group.note && <p>{group.note}</p>}</div>)}</div></div>
      </section>

      <section className="brochure-feed section" id="feed">
        <div className="brochure-split"><img className="brochure-scene" src={`${media}feed-delivery.webp`} width="1536" height="1024" alt="Illustration of a feed delivery truck beside poultry barn feed bins" loading="lazy" /><div><p className="eyebrow">From forecasting to pickup</p><h2>Feed Management</h2><p>Forecast requirements by feed type and barn to help place orders. Reconcile deliveries when they arrive. Follow feed movements between barns and farms, with a record of end-of-flock pickups and credits.</p><p>From the first delivery to the last pickup, keep the feed’s story with the flock.</p></div></div>
        <div className="brochure-phones">{capture(screens.tickets)}{capture(screens.drops)}{capture(screens.allocation)}</div>
        <div className="brochure-copy-columns"><div><h3>Choose the bin.<br />FlockTrax knows the flock.</h3><p>Your farm, barn and placement schedules give each delivery its context. Select the bins where the driver drops the order, and FlockTrax credits the feed to the flock using that barn.</p></div><div><h3>Move the feed.<br />Keep the accounting.</h3><p>When feed moves to another barn or an offsite farm, management records an internal feed ticket, numbered for your farm. It credits the original flock and identifies the receiving location, keeping feed consumption and transfers accounted for.</p></div></div>
      </section>

      <section className="brochure-work section" id="work-orders" aria-labelledby="work-orders-title">
        <div className="brochure-work-layout">
          <div><p className="eyebrow">Keep the team connected</p><h2 id="work-orders-title">Work Orders</h2><p className="section-lead">From discovery to completion.</p><p>Report items needing repair or inspection through Action Items while checking barns. Add dated updates as the work progresses so everyone can see what needs attention, what has changed, and what has been resolved.</p><p>Work orders and maintenance records stay connected to the barn and the people doing the work.</p><img className="brochure-scene" src={`${media}maintenance.webp`} width="1536" height="1024" alt="Illustration of two farm workers inspecting equipment outside a poultry barn" loading="lazy" /></div>
          {capture(screens.work, "work-capture")}
        </div>
      </section>

      <section className="brochure-audit section" id="documents" aria-labelledby="documents-title">
        <div><p className="eyebrow">Document archive</p><h2 id="documents-title">Audits become<br /><em>click &amp; show.</em></h2><p>Keep original flock documents digitized and stored with the flock records, just a click away. Hatch tickets, feed delivery tickets, livehaul shipping and scale tickets, and flock supervisor reports stay with the flock’s history.</p><p>Open the supporting original from the Flock Detail Report, including after settlement and archival. Spend the review looking at the records instead of searching file folders.</p></div>
        {capture(screens.audit)}
      </section>

      <section className="brochure-integrations section" id="integrations">
        <div className="brochure-section-heading"><p className="eyebrow">BinSentry feed monitoring API</p><h2>Forecast Feed Requirements</h2><p>Bring feed on hand and feed on order into the same picture. FlockTrax uses BinSentry data to calculate future feed requirements by type, across individual barns, multiple farms or an integrated operation.</p><p>Feed delivery and drop reports show which bins received feed during a requested period, helping reconcile delivery tickets with physical evidence from bin readings.</p></div>
        <div className="brochure-forecast">{capture(screens.daily)}{capture(screens.order)}</div>
        <div className="brochure-split integration-split">{capture(screens.bins)}<div><p className="eyebrow">Frame the big picture</p><h3>Custom API Modules</h3><p>Suitable third-party data sources can be developed into automated inputs for FlockTrax, connecting the systems your business already uses.</p><h4>Currently available integrations</h4><ul className="integration-list"><li><strong>BinSentry</strong><span>Feed bin monitoring.</span></li><li><strong>Google Cloud</strong><span>Selected Sheets and Calendar workflows.</span></li><li><strong>AccuWeather</strong><span>Farm-location weather and forecasts.</span></li></ul></div></div>
      </section>

      <section className="brochure-story section" id="story">
        <div className="story-intro"><p className="eyebrow">Built in the barn · West, Texas</p><h2>Your Flocks Deserve<br />a Clearer Picture.</h2><p className="story-byline">The story behind FlockTrax</p></div>
        <div className="story-prose"><p>FlockTrax was developed by Smotherman Farms, Ltd. in West, Texas, where Ken brought together two careers: corporate information systems and automation, and twenty-five years as a contract poultry owner-grower.</p><p>Over those years, one question kept coming back:</p><blockquote>How did an industry this advanced leave the grower holding a clipboard?</blockquote><p>Poultry production runs on science, research, and technology. Yet the information connecting growers and integrators still too often travels by pen, paper, and fax machine.</p><p>To Ken, that felt a little like sending smoke signals from a state-of-the-art barn.</p><p>He knew the work firsthand—the daily checks, the feed deliveries, the flock records, and the decisions that couldn’t wait for someone to find a piece of paper. He also knew what automation could do. FlockTrax grew from putting those two kinds of experience to work.</p><p>It connects what happens in the barns with the people making decisions, coordinating production, and scheduling at the plant. From placement through closeout, it brings the flock’s story together so the people responsible for it can see the big picture.</p><p className="story-signoff">Built by a farmer, for farmers—and everyone counting on them.</p></div>
      </section>

      <section className="contact section" id="contact"><div className="request-title-block"><img className="request-bird" src="/marketing/media/flocktrax-bird-original.svg" alt="" /><div><p className="eyebrow">Let’s look at your operation</p><h2>It’s All About<br />the Flocks…</h2></div></div><p>See how FlockTrax brings your operation into focus.</p><DemoRequestForm /><div className="contact-details"><strong>Ken Smotherman</strong><a href="mailto:ken@FlockTrax.com">ken@FlockTrax.com</a><a href="tel:+12547156101">(254) 715-6101</a></div><a className="demo-link" href="https://flocktrax-demo.vercel.app">Already have demo access? Open the demo <ArrowUpRight size={16} /></a><small className="credentials">Evaluator credentials required. For the best Admin experience, use a desktop monitor or tablet.</small></section>
    </main>

    <footer className="fixed-footer" ref={footer}><a className="wordmark" href="#main">{brand}</a><p className="ownership-claim">The FlockTrax™ Platform  (FlockTrax-ADMIN™, FlockTrax-MOBILE™ &amp; their hosted Postgres Database) are Trademarks of Smotherman Farms, Ltd.  West, Texas USA Copyright © 2026 All Rights Reserved.</p><div className="footer-actions"><div><a href="/login">Admin sign in</a><button className="footer-link" onClick={() => privacyDialog.current?.showModal()}>Privacy policy</button></div><p>Farm photographs are AI-generated.</p></div></footer>
    <dialog className="brochure-layout-dialog" ref={layoutDialog} aria-labelledby="layout-title" onClick={event => { if (event.target === layoutDialog.current) layoutDialog.current?.close(); }}>
      <div className="dialog-head"><strong id="layout-title">The FlockTrax layout</strong><button type="button" autoFocus onClick={() => layoutDialog.current?.close()} aria-label="Close FlockTrax layout"><X size={24} /></button></div>
      <div className="layout-content">
        <figure className="brochure-architecture"><img src={`${media}architecture.webp`} width="1536" height="1024" alt="FlockTrax-Mobile across multiple farms and FlockTrax-Admin connect to a shared data platform, with feed, corporate information and weather integrations and add-on modules" loading="lazy" /><figcaption>Two applications, a shared data platform and connected services.</figcaption></figure>
        <div className="platform-key"><p><strong>Mobile</strong>Collect flock activity where the work happens.</p><p><strong>Admin</strong>Manage schedules, feed, work orders, closeouts and history.</p><p><strong>Shared data platform</strong>Operational records, authentication, access controls and original-document storage.</p><p><strong>Integration services</strong>Feed monitoring, selected corporate data workflows and weather context.</p></div>
        <button type="button" className="button gold layout-return" onClick={() => layoutDialog.current?.close()}>Return to the landing page</button>
      </div>
    </dialog>
    <dialog className="privacy-dialog" ref={privacyDialog} aria-labelledby="privacy-title" onClick={event => { if (event.target === privacyDialog.current) privacyDialog.current?.close(); }}><div className="dialog-head"><strong id="privacy-title">FlockTrax Privacy Policy</strong><button autoFocus onClick={() => privacyDialog.current?.close()} aria-label="Close privacy policy"><X size={24} /></button></div><article className="privacy-content">{policyText.trim().split(/\r?\n\r?\n/).slice(1).map((block, index) => <p key={index}>{block}</p>)}</article><div className="privacy-actions"><button className="button gold" onClick={() => privacyDialog.current?.close()}>Return to FlockTrax</button></div></dialog>
    <dialog className="brochure-viewer" ref={dialog} aria-label={expanded?.title || "Product screenshot"} onClick={event => { if (event.target === dialog.current) dialog.current?.close(); }}><div className="dialog-head"><strong>{expanded?.title}</strong><div>{expanded && <a href={`${media}${expanded.image}.webp`} target="_blank" rel="noopener noreferrer">Open original <ArrowUpRight size={16} /></a>}<button autoFocus onClick={() => dialog.current?.close()} aria-label="Close screenshot"><X size={24} /></button></div></div>{expanded && <img className="original" src={`${media}${expanded.image}.webp`} alt={expanded.alt} />}</dialog>
  </div>;
}
