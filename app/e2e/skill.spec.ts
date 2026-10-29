import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("the Claude skill can be downloaded from the app", async ({ page, request }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Get the Claude skill" }).click();
  await expect(page.getByRole("heading", { name: "Make a chart with Claude" })).toBeVisible();
  const link = page.getByRole("link", { name: "Download the skill" });
  await expect(link).toHaveAttribute("href", /doubletake-chart-skill\.zip$/);

  const response = await request.get("/skill/doubletake-chart-skill.zip");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("zip");
  const body = await response.body();
  expect(body.length).toBeGreaterThan(10_000);

  // The zip holds the skill's instructions and the one-file script
  const dir = mkdtempSync(join(tmpdir(), "skillzip-"));
  const file = join(dir, "skill.zip");
  writeFileSync(file, body);
  const listing = execFileSync("unzip", ["-l", file], { encoding: "utf-8" });
  expect(listing).toContain("doubletake-chart/SKILL.md");
  expect(listing).toContain("doubletake-chart/scripts/doubletake.mjs");
});

test("the skill page opens offline once loaded", async ({ page, context }) => {
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.goto("/#/skill");
  await expect(page.getByRole("heading", { name: "Make a chart with Claude" })).toBeVisible();
  await context.setOffline(false);
});
