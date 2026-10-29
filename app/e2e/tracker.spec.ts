import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const leopardPath = fileURLToPath(new URL("../../fixtures/leopard/leopard.doubletake.json", import.meta.url));

async function startLeopard(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Use this chart" }).first().click();
  await expect(page.getByText("Round 1 of 95")).toBeVisible();
}

const nextRound = (page: Page) => page.getByRole("button", { name: /done, next$/ }).click();

test("the leopard example starts on round 1", async ({ page }) => {
  await startLeopard(page);
  await expect(page.getByRole("heading", { name: "Chart A, pairs 1–56" })).toBeVisible();
  await expect(page.getByText("112 pairs · 224 stitches")).toBeVisible();
});

test("closing and reopening returns to the same round", async ({ page }) => {
  await startLeopard(page);
  await nextRound(page);
  await nextRound(page);
  await expect(page.getByText("Round 3 of 95")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Round 3 of 95")).toBeVisible();
});

test("undo puts the round back", async ({ page }) => {
  await startLeopard(page);
  await nextRound(page);
  await expect(page.getByText("Round 2 of 95")).toBeVisible();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByText("Round 1 of 95")).toBeVisible();
});

test("works offline after the first load, on the same round", async ({ page, context }) => {
  await startLeopard(page);
  await nextRound(page);
  await nextRound(page);
  await nextRound(page);
  await expect(page.getByText("Round 4 of 95")).toBeVisible();
  // Let the service worker finish caching, then reload once so it controls the page.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText("Round 4 of 95")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Chart A, pairs 1–56" })).toBeVisible();
  await context.setOffline(false);
});

test("a bad chart file gives specific errors and changes nothing", async ({ page }) => {
  await startLeopard(page);
  await page.goto("/#/");
  await expect(page.getByRole("heading", { name: "Your hats" })).toBeVisible();
  const before = await page.getByRole("button", { name: /^Open / }).count();

  const chart = JSON.parse(readFileSync(leopardPath, "utf-8"));
  chart.body[11] = chart.body[11].slice(0, 111);
  await page.locator("#import-file").setInputFiles({ name: "bad.doubletake.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(chart)) });
  const alert = page.getByRole("alert");
  await expect(alert).toContainText("That file can’t be used");
  await expect(alert).toContainText("Round 12");
  await expect(page.getByRole("button", { name: /^Open / })).toHaveCount(before);

  await page.locator("#import-file").setInputFiles({ name: "notes.json", mimeType: "application/json", buffer: Buffer.from("hello") });
  await expect(page.getByRole("alert")).toContainText("isn’t valid JSON");
  await expect(page.getByRole("button", { name: /^Open / })).toHaveCount(before);
});

test("a valid chart file creates a project", async ({ page }) => {
  await page.goto("/");
  await page.locator("#import-file").setInputFiles(leopardPath);
  await expect(page.getByText("Round 1 of 95")).toBeVisible();
  await page.goto("/#/");
  await expect(page.getByRole("heading", { name: "Your hats" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Open Leopard/ })).toHaveCount(1);
});

test("a backup restores a hat with its progress", async ({ page }) => {
  await startLeopard(page);
  await nextRound(page);
  await nextRound(page);
  await page.getByRole("link", { name: "More" }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Back up this hat" }).click();
  const file = await (await download).path();
  await page.goto("/#/");
  await page.locator("#import-file").setInputFiles(file);
  await expect(page.getByText("Round 3 of 95")).toBeVisible();
});

test("the crown shows its note and decrease key at round 76", async ({ page }) => {
  await startLeopard(page);
  for (let i = 0; i < 75; i++) await nextRound(page);
  await expect(page.getByText("Round 76 of 95")).toBeVisible();
  await expect(page.getByRole("heading", { name: "The crown starts" })).toBeVisible();
  await expect(page.getByText("right-leaning decrease").first()).toBeVisible();
  await expect(page.getByText("Ends with 104 pairs (208 stitches)")).toBeVisible();
});

test("the duplicate stitch tracker counts patches and faces", async ({ page }) => {
  await startLeopard(page);
  await page.getByRole("link", { name: "Stitch" }).click();
  await expect(page.getByText("0 of 33 patches done")).toBeVisible();
  await page.getByRole("button", { name: "Outside: mark as done" }).click();
  await expect(page.getByText("0 of 33 patches done")).toBeVisible(); // one face is not enough
  await page.getByRole("button", { name: "Inside: mark as done" }).click();
  await expect(page.getByText("1 of 33 patches done")).toBeVisible();
  await page.getByRole("button", { name: "Next patch to do" }).click();
  await expect(page.getByRole("heading", { name: "Patch 2 of 33" })).toBeVisible();
});

test("nothing is sent to any other site", async ({ page }) => {
  const external: string[] = [];
  const origin = new URL("http://localhost:4173").origin;
  page.on("request", (req) => {
    const url = new URL(req.url());
    if (url.protocol.startsWith("http") && url.origin !== origin) external.push(req.url());
  });
  await startLeopard(page);
  await page.getByRole("link", { name: "Stitch" }).click();
  await page.getByRole("link", { name: "More" }).click();
  await page.locator("#main").getByRole("link", { name: "About Doubletake" }).click();
  await expect(page.getByRole("heading", { name: "About Doubletake" })).toBeVisible();
  expect(external).toEqual([]);
});

test("stays usable at 200% text size in dark mode", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await startLeopard(page);
  await page.evaluate(() => (document.documentElement.style.fontSize = "200%"));
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
});
