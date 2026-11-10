/**
 * Saves the leopard example's chart pages (Chart A and B, duplicate stitch, crown) as an A4 PDF, for the pattern PDF.
 * Needs the app running (npm run dev -w app) and Chromium for Playwright.
 *   node tools/make_leopard_chart_pages.mjs [out.pdf] [http://localhost:5173]
 * The "how to read the charts" page is left out (the pattern has its own). The running header and a note above each
 * chart say that these are the example pages.
 */
import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";

const out = process.argv[2] ?? "leopard-chart-pages.pdf";
const base = process.argv[3] ?? "http://localhost:5173";
const leopard = fileURLToPath(new URL("../fixtures/leopard/leopard.doubletake.json", import.meta.url));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1000, height: 1400 } });
await page.goto(base + "/");
await page.locator("#import-file").setInputFiles(leopard);
await page.getByText("Round 1 of 121").waitFor();
const id = page.url().split("/p/")[1].split("/")[0];
await page.goto(`${base}/#/p/${id}/print`);
await page.locator(".sheet").first().waitFor();
await page.evaluate(() => {
  const sheets = [...document.querySelectorAll(".sheet")];
  for (const s of sheets) {
    const h2 = s.querySelector("h2")?.textContent ?? "";
    if (!s.querySelector("svg") || h2 === "stripes") { s.remove(); continue; }
    const hdr = s.querySelector(".hdr");
    if (hdr) hdr.innerHTML = '<span class="l">doubletake · leopard example · </span><span class="b">freya’d knot</span>';
    const note = document.createElement("p");
    note.className = "meta";
    note.style.cssText = "margin:0 0 1mm;font-weight:700;color:#f26b5b";
    note.textContent = "Example chart: leopard print";
    s.querySelector("h2")?.before(note);
  }
});
await page.emulateMedia({ media: "print" });
await page.pdf({ path: out, format: "A4", printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
await browser.close();
console.log("wrote", out);
