// Pulls the latest data from the Chartink dashboard and writes it into index.html.
// Usage:
//   node scripts/update.mjs                 -> scrape chartink.com (needs Playwright + Chromium)
//   node scripts/update.mjs --from-json f   -> use a saved DATA json instead (for testing)
import fs from 'node:fs';
import path from 'node:path';

const DASHBOARD = 'https://chartink.com/dashboard/499165';
const PAGE = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'index.html');
const BLOCK = /\/\*DATA-START\*\/[\s\S]*?\/\*DATA-END\*\//;

// Runs inside the Chartink page: asks each widget to reload, captures the raw server
// responses, and builds the DATA object the page uses.
async function extract() {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const findWidgets = () => [...new Set([...document.querySelectorAll('*')].map(e => e.__vue__).filter(v => v && v.$options && v.$options.name === 'widget'))];
  let ws = findWidgets();
  for (let i = 0; i < 40 && (ws.length < 6 || !window.axios); i++) { await wait(500); ws = findWidgets(); }
  if (!window.axios || !ws.length) throw new Error('Dashboard widgets did not load. Chartink may require you to be logged in: add the CHARTINK_COOKIE secret (see README).');
  const cap = [], ax = window.axios;
  const id = ax.interceptors.response.use(r => { try { if (String(r.config && r.config.url).includes('widget/process')) cap.push(typeof r.data === 'string' ? JSON.parse(r.data) : r.data); } catch (e) {} return r; });
  for (const w of ws) { try { w.cancelChartRequest(); w.chartRequest = null; w.loadChart(true); } catch (e) {} }
  const t0 = Date.now(); while (cap.length < ws.length && Date.now() - t0 < 45000) await wait(300);
  ax.interceptors.response.eject(id);
  const ser = {}, sectors = {}, ends = []; let tt = null;
  for (const g of cap) {
    if (!g || !g.metaData) continue;
    const md = g.metaData[0]; ends.push(md.tradeTimes[md.tradeTimes.length - 1]);
    if (g.groups.length > 5) { g.groupData.forEach(gr => { sectors[gr.name] = Object.values(gr.results[0])[0]; }); continue; }
    g.groupData[0].results.forEach(o => { const k = Object.keys(o)[0]; ser[k] = o[k]; });
    if (md.columnAliases[0] === '20') tt = md.tradeTimes;
  }
  const need = ['20', 'sma5(20)', '50', 'sma5(50)', '200', 'sma5(200)', 'soft', 'sma5', 'net nh-nl % 252 day'];
  const miss = need.filter(k => !ser[k]);
  if (miss.length || !tt || Object.keys(sectors).length < 20) throw new Error('Dashboard data incomplete: ' + (miss.join(', ') || 'sector widget'));
  if (new Set(ends).size > 1) throw new Error('Widgets end on different dates');
  const L = Math.min(22, tt.length, ...need.map(k => ser[k].length), ...Object.values(sectors).map(a => a.length));
  if (L < 15) throw new Error('Too few sessions returned: ' + L);
  const cut = a => a.slice(-L).map(v => Math.round(v * 100) / 100);
  const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const f = t => { const d = new Date(t + 19800000); return d.getUTCDate() + ' ' + M[d.getUTCMonth()]; };
  const lt = tt[tt.length - 1];
  const DATA = { asOf: f(lt) + ' ' + new Date(lt + 19800000).getUTCFullYear(), dates: tt.slice(-L).map(f),
    t20: cut(ser['20']), a20: cut(ser['sma5(20)']), t50: cut(ser['50']), a50: cut(ser['sma5(50)']),
    t200: cut(ser['200']), a200: cut(ser['sma5(200)']), hom: cut(ser['soft']), ahom: cut(ser['sma5']),
    nh: cut(ser['net nh-nl % 252 day']), sectors: {} };
  for (const k in sectors) DATA.sectors[k] = cut(sectors[k]);
  return DATA;
}

function parseCookies(str) {
  return str.split(';').map(p => p.trim()).filter(Boolean).map(p => {
    const i = p.indexOf('=');
    return { name: p.slice(0, i).trim(), value: p.slice(i + 1).trim(), domain: 'chartink.com', path: '/', secure: true };
  }).filter(c => c.name);
}

async function scrape() {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({
      viewport: { width: 1600, height: 1000 }, timezoneId: 'Asia/Kolkata', locale: 'en-IN',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
    });
    if (process.env.CHARTINK_COOKIE) await ctx.addCookies(parseCookies(process.env.CHARTINK_COOKIE));
    const page = await ctx.newPage();
    let lastErr;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        await page.goto(DASHBOARD, { waitUntil: 'networkidle', timeout: 90000 });
        await page.waitForTimeout(5000);
        return await page.evaluate(extract);
      } catch (e) { lastErr = e; console.log(`Attempt ${attempt} failed: ${e.message}`); await page.waitForTimeout(30000); }
    }
    throw lastErr;
  } finally { await browser.close(); }
}

const zone = v => v > 80 ? 'Extended' : v > 50 ? 'Strong' : v >= 20 ? 'Choppy' : 'Near the bottom';
function nhLabel(v) {
  const n = v[v.length - 1];
  if (n > 5) return 'Strong';
  if (v.slice(-3).every(x => x > 0)) return 'Mild positive';
  if (n < -2) return 'Weak';
  if (n <= 2) return 'Weak & choppy';
  return 'Positive';
}

const args = process.argv.slice(2);
const data = args[0] === '--from-json' ? JSON.parse(fs.readFileSync(args[1], 'utf8')) : await scrape();

const html = fs.readFileSync(PAGE, 'utf8');
const m = html.match(BLOCK);
if (!m) throw new Error('DATA block not found in index.html');
const oldAsOf = (m[0].match(/"asOf":"([^"]+)"/) || [])[1];
const last = a => a[a.length - 1];
const top = Object.entries(data.sectors).sort((a, b) => last(b[1]) - last(a[1])).slice(0, 3).map(([k, v]) => `${k} ${last(v)}`).join(', ');
const summary = `GM World ${data.asOf}: Short 20 = ${last(data.t20)} (${zone(last(data.t20))}), Medium 50 = ${last(data.t50)} (${zone(last(data.t50))}), ` +
  `Long 200 = ${last(data.t200)} (${zone(last(data.t200))}), Homma = ${last(data.hom)} (${zone(last(data.hom))}), ` +
  `Net NH-NL = ${last(data.nh)}% (${nhLabel(data.nh)}). Top sectors: ${top}.`;

const updated = oldAsOf !== data.asOf;
if (!updated) {
  console.log(`No new trading day since ${oldAsOf}; page left unchanged.`);
} else {
  fs.writeFileSync(PAGE, html.replace(BLOCK, `/*DATA-START*/const DATA = ${JSON.stringify(data)};/*DATA-END*/`));
  console.log('Updated index.html');
}
console.log(summary);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary + '\n');
if (process.env.GITHUB_OUTPUT) {
  const d = new Date(Date.now() + 19800000).toISOString().slice(0, 10);
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `updated=${updated}\nasof=${data.asOf}\ndate=${d}\nsummary=${summary}\n`);
}
