// Saves index.html as a one-page PDF (light theme, full height).
// Usage: node scripts/pdf.mjs <output.pdf>
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const out = process.argv[2] || 'gm-world.pdf';
const page_ = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'index.html');

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  await page.emulateMedia({ media: 'screen', colorScheme: 'light' });
  await page.goto(pathToFileURL(page_).href, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForFunction(() => window.Chart && document.querySelectorAll('canvas').length >= 6, null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  const height = await page.evaluate(() => Math.ceil(document.documentElement.scrollHeight));
  await page.pdf({ path: out, width: '1200px', height: `${height + 40}px`, printBackground: true, pageRanges: '1' });
  console.log(`Saved ${out}`);
} finally {
  await browser.close();
}
