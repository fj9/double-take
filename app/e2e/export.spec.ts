import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { execFileSync } from "node:child_process";

async function leopardMore(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Use this chart" }).first().click();
  await expect(page.getByText("Round 1 of 95")).toBeVisible();
  await page.getByRole("link", { name: "More" }).click();
  await expect(page.getByRole("heading", { name: "Print and export" })).toBeVisible();
}

test("the chart pages are one sheet to a page and print to a PDF with the same number of pages", async ({ page }) => {
  await leopardMore(page);
  await page.getByRole("link", { name: "Chart pages (PDF)" }).click();
  await expect(page.getByRole("heading", { name: "Chart pages" })).toBeVisible();
  const sheets = page.locator(".sheet");
  await expect(sheets).toHaveCount(9); // how to read, body A and B, duplicate A and B, crown A and B, crown duplicate A and B
  await expect(page.getByText("Page 3 of 9")).toBeVisible();
  await expect(page.getByRole("heading", { name: "chart A" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "plain crown A" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "patterned crown A" })).toBeVisible();

  // Every chart is real SVG that the browser can parse, and sits inside its sheet
  const bad = await page.evaluate(() => {
    const problems: string[] = [];
    document.querySelectorAll(".sheet .svgwrap").forEach((el, i) => {
      const doc = new DOMParser().parseFromString(el.innerHTML, "image/svg+xml");
      if (doc.querySelector("parsererror")) problems.push(`sheet ${i + 2}: not valid SVG`);
      const sheet = el.closest(".sheet") as HTMLElement;
      const svg = el.querySelector("svg") as SVGElement;
      const s = sheet.getBoundingClientRect();
      const v = svg.getBoundingClientRect();
      const footer = (sheet.querySelector("footer") as HTMLElement).getBoundingClientRect();
      if (v.right > s.right + 1) problems.push(`sheet ${i + 2}: chart runs off the right edge`);
      if (v.bottom > footer.top) problems.push(`sheet ${i + 2}: chart runs into the footer`);
    });
    return problems;
  });
  expect(bad).toEqual([]);

  // Printed, each sheet is exactly one A4 page
  const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
  const pages = (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
  expect(pages).toBe(9);
  expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
});

test("the footer on the chart pages has the Freya'd Knot links and the personal use line for the example", async ({ page }) => {
  await leopardMore(page);
  await page.getByRole("link", { name: "Chart pages (PDF)" }).click();
  const footer = page.locator(".sheet footer").first();
  await expect(footer.getByRole("link", { name: /Ravelry/ })).toHaveAttribute("href", "https://www.ravelry.com/people/freyadknot");
  await expect(footer.getByRole("link", { name: /Instagram/ })).toBeVisible();
  await expect(footer.getByRole("link", { name: /Ko-fi/ })).toBeVisible();
  await expect(footer).toContainText("Pattern for personal use only");
});

test("everything downloads as one zip with pictures, spreadsheets and a shopping list", async ({ page }) => {
  await leopardMore(page);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download everything (zip)" }).click();
  const d = await download;
  expect(d.suggestedFilename()).toBe("leopard-patterned-crown.zip");
  const path = await d.path();
  expect(execFileSync("unzip", ["-tq", path], { encoding: "utf-8" })).toContain("No errors");
  const list = execFileSync("unzip", ["-l", path], { encoding: "utf-8" });
  for (const f of ["leopard-patterned-crown.doubletake.json", "outside.png", "inside.png", "outside.svg", "inside.svg", "chart.csv", "yarns.csv", "shopping-list.txt", "duplicate-stitch-c.csv"]) {
    expect(list).toContain(`leopard-patterned-crown/${f}`);
  }
  const png = execFileSync("unzip", ["-p", path, "leopard-patterned-crown/outside.png"]);
  expect([...png.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  expect(png.length).toBeGreaterThan(5000);
  const svg = execFileSync("unzip", ["-p", path, "leopard-patterned-crown/inside.svg"], { encoding: "utf-8", maxBuffer: 50 * 1024 * 1024 });
  expect(svg.startsWith("<svg xmlns")).toBe(true);
  const csv = execFileSync("unzip", ["-p", path, "leopard-patterned-crown/chart.csv"], { encoding: "utf-8" });
  expect(csv.trimEnd().split("\n")).toHaveLength(96);
  // The chart file inside the zip can be imported again
  const json = execFileSync("unzip", ["-p", path, "leopard-patterned-crown/leopard-patterned-crown.doubletake.json"], { encoding: "utf-8" });
  expect(JSON.parse(json).schema).toBe("doubletake-chart/1");
});
