import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { fileURLToPath } from "node:url";

const stripes = fileURLToPath(new URL("../../fixtures/stripes/bands.doubletake.json", import.meta.url));

async function importStripes(page: Page) {
  await page.goto("/");
  await page.locator("#import-file").setInputFiles(stripes);
  await expect(page.getByText("Round 1 of 95")).toBeVisible();
}
const next = (page: Page) => page.getByRole("button", { name: /done, next$/ }).click();

test("a striped hat shows its two colours each round and the jogless prompts", async ({ page }) => {
  await importStripes(page);
  await expect(page.locator("p", { hasText: "Colours this round:" })).toContainText("sand (A)");
  await expect(page.locator("p", { hasText: "Colours this round:" })).toContainText("grass (B)");
  for (let i = 0; i < 38; i++) await next(page);
  await expect(page.getByText("Round 39 of 95")).toBeVisible();
  await expect(page.getByRole("heading", { name: "New stripe" })).toBeVisible();
  await expect(page.locator("p", { hasText: "Colours this round:" })).toContainText("cloud (D)");
  await next(page);
  await expect(page.getByRole("heading", { name: /Jogless step/ })).toBeVisible();
  await expect(page.getByText(/still to be test-knit/)).toBeVisible();
  await next(page);
  await expect(page.getByRole("heading", { name: /Jogless step/ })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "New stripe" })).toHaveCount(0);
});

test("the cast on step uses the colours of round 1", async ({ page }) => {
  await importStripes(page);
  await page.getByRole("link", { name: "Steps" }).click();
  await expect(page.getByText(/Use the two colours for round 1 \(sand and grass\)/)).toBeVisible();
});

test("the stripes appear on the printed pages and in the zip's stripes sheet", async ({ page }) => {
  await importStripes(page);
  await page.getByRole("link", { name: "Hat" }).click();
  await page.getByRole("link", { name: "Chart pages (PDF)" }).click();
  await expect(page.getByRole("heading", { name: "stripes" })).toBeVisible();
  await expect(page.locator(".ptable tbody tr")).toHaveCount(3);
  await expect(page.locator(".ptable")).toContainText("1–38");
});

test("the pace planner spreads the rounds over the days and shows how you are doing", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Use this chart" }).first().click();
  await expect(page.getByText("Round 1 of 95")).toBeVisible();
  await page.getByRole("link", { name: "Steps" }).click();
  const d = new Date();
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  await page.getByLabel("Start date").fill(iso);
  await page.getByLabel("Number of days").fill("10");
  await page.getByRole("button", { name: "Make a plan" }).click();
  await expect(page.getByText("10 days from")).toBeVisible();
  await expect(page.getByText("By the end of today, aim for round 10: 10 rounds behind.")).toBeVisible();
  await page.getByText("All 10 days").click();
  await expect(page.getByText("Day 1 ·")).toBeVisible();
  await expect(page.locator(".pill", { hasText: "Today" })).toBeVisible();
  await expect(page.getByText("rounds 1–10")).toBeVisible();

  // It shows on the round view too, and keeps up as you knit
  await page.getByRole("link", { name: "Round", exact: true }).click();
  await expect(page.getByText("aim for round 10: 10 rounds behind")).toBeVisible();
  for (let i = 0; i < 10; i++) await next(page);
  await expect(page.getByText("aim for round 10: on track")).toBeVisible();

  // It is kept when the page is reloaded, and can be removed
  await page.reload();
  await expect(page.getByText("aim for round 10: on track")).toBeVisible();
  await page.getByRole("link", { name: "Steps" }).click();
  await page.getByRole("button", { name: "Remove the plan" }).click();
  await expect(page.getByRole("button", { name: "Make a plan" })).toBeVisible();
  await page.getByRole("link", { name: "Round", exact: true }).click();
  await expect(page.getByText("Your plan:")).toHaveCount(0);
});

test("a plan is not part of the chart file, or a shared chart", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Use this chart" }).first().click();
  await page.getByRole("link", { name: "Steps" }).click();
  await page.getByRole("button", { name: "Make a plan" }).click();
  await page.getByRole("link", { name: "Hat" }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Share the chart (no progress)" }).click();
  const file = await (await download).path();
  const text = (await import("node:fs")).readFileSync(file, "utf-8");
  expect(text).not.toContain("pace");
  expect(text).not.toContain('"start"');
});
