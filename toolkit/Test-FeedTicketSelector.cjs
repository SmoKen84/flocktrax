// Browser regression test using synthetic data; no server credentials or data writes.
// Install playwright and esbuild in a separate QA directory, set NODE_PATH to its
// node_modules, then run: node toolkit/Test-FeedTicketSelector.cjs
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const esbuild = require("esbuild");
const { chromium, webkit, devices } = require("playwright");

const app = path.resolve(__dirname, "../web-admin");
const cases = [
  ["iPhone SE", webkit, devices["iPhone SE"]],
  ["iPhone 13", webkit, devices["iPhone 13"]],
  ["iPhone landscape", webkit, { ...devices["iPhone 13"], viewport: { width: 844, height: 390 } }],
  ["Android", chromium, devices["Pixel 7"]],
  ["iPad", webkit, devices["iPad (gen 7)"]],
  ["Desktop", chromium, { viewport: { width: 1440, height: 1000 } }],
];

async function main() {
  const bundle = await esbuild.build({
    stdin: {
      contents: `
        import React from "react";
        import { createRoot } from "react-dom/client";
        import { FeedTicketConsole } from "./app/admin/feed-tickets/feed-ticket-console";
        const filters = {
          listMode: "ticket", ticketNumber: "", ticketTypes: [],
          hasRedirectedDropsOnly: false, hasQueuedDropsOnly: false,
          farm: "", barn: "", bin: "", sourceType: "", flockCode: "",
          dateFrom: "", dateTo: "", includeStarter: false, includeGrower: false,
        };
        const data = {
          rows: [], filters, rollups: {}, summaryText: "Synthetic test data",
          filterOptions: {
            farms: ["Test Farm"], barns: ["Test Barn"], bins: ["Test Bin"],
            flocks: Array.from({length: 100}, (_, i) => "TEST-" + String(i).padStart(3, "0")),
          },
        };
        window.open = (url) => { window.reportUrl = url; };
        createRoot(document.getElementById("root")).render(
          <main className="splash-shell admin-shell">
            <aside className="splash-sidebar-stack" style={{minHeight: 950}}>Test sidebar</aside>
            <div className="content-shell">
              <section className="panel hero-panel">Feed Tickets</section>
              <FeedTicketConsole bundle={data} ticketTypeOptions={[]} />
            </div>
          </main>
        );
      `,
      resolveDir: app,
      loader: "tsx",
    },
    bundle: true,
    write: false,
    jsx: "automatic",
    plugins: [{
      name: "fixture-boundaries",
      setup(build) {
        build.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: "router", namespace: "fixture" }));
        build.onResolve({ filter: /^\.\/feed-ticket-(editor|document-uploader)$/ }, () => ({ path: "unused", namespace: "fixture" }));
        build.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path: name }) => ({
          contents: name === "router"
            ? 'export const useRouter = () => ({push: url => {window.filterUrl = url;}, refresh: () => {}}); export const usePathname = () => "/admin/feed-tickets";'
            : 'export const FeedTicketEditor = () => null; export const FeedTicketDocumentUploader = () => null;',
        }));
      },
    }],
  });
  const css = fs.readFileSync(path.join(app, "app/globals.css"), "utf8");
  const server = http.createServer((req, res) => {
    if (req.url === "/fixture.js") {
      res.setHeader("Content-Type", "text/javascript");
      res.end(bundle.outputFiles[0].text);
    } else if (req.url === "/globals.css") {
      res.setHeader("Content-Type", "text/css");
      res.end(css);
    } else {
      res.setHeader("Content-Type", "text/html");
      res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/globals.css"><div id="root"></div><script src="/fixture.js"></script>');
    }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    for (const [name, engine, options] of cases.filter(([name]) => !process.argv[2] || name === process.argv[2])) {
      const browser = await engine.launch();
      try {
        const page = await browser.newPage(options);
        const errors = [];
        page.on("pageerror", error => errors.push(error.message));
        await page.goto(`http://127.0.0.1:${server.address().port}`);
        const activate = async locator => options.hasTouch ? locator.tap() : locator.click();
        const field = page.locator(".feed-ticket-flat-flock-field button");
        await field.scrollIntoViewIfNeeded();
        await activate(field);
        const scrim = page.locator(".feed-ticket-selector-scrim");
        const geometry = await scrim.evaluate(el => {
          const rect = el.getBoundingClientRect();
          return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, vw: innerWidth, vh: innerHeight };
        });
        if (process.env.FEED_SELECTOR_SCREENSHOTS) {
          fs.mkdirSync(process.env.FEED_SELECTOR_SCREENSHOTS, { recursive: true });
          await page.screenshot({ path: path.join(process.env.FEED_SELECTOR_SCREENSHOTS, `${name}.png`) });
        }
        assert.ok(Math.abs(geometry.y) < 1 && Math.abs(geometry.x) < 1, `${name}: popup must cover viewport: ${JSON.stringify(geometry)}`);
        const card = await page.locator(".feed-ticket-selector-card").boundingBox();
        assert.ok(card.y >= 0 && card.y + card.height <= geometry.vh + 1, `${name}: whole dialog must fit`);
        const first = page.getByRole("button", { name: "TEST-000", exact: true });
        await activate(first);
        assert.equal(await scrim.count(), 0, `${name}: selection closes popup`);
        assert.equal(await field.innerText(), "TEST-000");
        await activate(field);
        const last = page.getByRole("button", { name: "TEST-099", exact: true });
        await last.scrollIntoViewIfNeeded();
        await activate(last);
        assert.equal(await field.innerText(), "TEST-099", `${name}: selection after list scroll`);
        const report = page.getByRole("button", { name: "Print Flock Report", exact: true });
        assert.equal(await report.isEnabled(), true);
        await activate(report);
        assert.equal(await page.evaluate(() => window.reportUrl), "/admin/feed-tickets/report?flockCode=TEST-099");
        await activate(page.getByRole("button", { name: "Apply", exact: true }));
        assert.equal(await page.evaluate(() => window.filterUrl), "/admin/feed-tickets?listMode=ticket&flockCode=TEST-099");
        await activate(field);
        await activate(page.getByRole("button", { name: "Clear Selection", exact: true }));
        assert.equal(await field.innerText(), "Flock Code");
        assert.equal(await report.isEnabled(), false);
        await activate(field);
        await activate(page.getByRole("button", { name: "Close", exact: true }));
        assert.equal(await scrim.count(), 0);
        assert.deepEqual(errors, []);
        console.log(`PASS ${name}: viewport, tap/click, list scroll, report, apply, clear, close`);
      } finally {
        await browser.close();
      }
    }
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
