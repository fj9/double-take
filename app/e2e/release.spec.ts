import { expect, test } from "@playwright/test";

test("the About page has the hashtag, the credit and the links", async ({ page }) => {
  await page.goto("/#/about");
  await expect(page.getByRole("heading", { name: "About Doubletake" })).toBeVisible();
  await expect(page.getByText("#doubletakehat")).toBeVisible();
  await expect(page.getByText("Chrysanthemum hat by mirielgw")).toBeVisible();
  await expect(page.getByText(/personal use only/)).toBeVisible();
  for (const name of ["Ravelry", "Instagram", "GitHub", "Ko-fi"]) await expect(page.locator("main").getByRole("link", { name }).first()).toBeVisible();
  await expect(page.getByText(/Version 0\.1\.0/)).toBeVisible();
});

test("the share-your-hat note appears when every round is done", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Use this chart" }).first().click();
  await page.getByRole("link", { name: "Steps", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Share your hat" })).toHaveCount(0);
  await page.getByRole("link", { name: "Round", exact: true }).click();
  for (let i = 0; i < 95; i++) await page.getByRole("button", { name: /done, next$/ }).click();
  await expect(page.getByText("All 95 rounds are knitted")).toBeVisible();
  await page.getByRole("link", { name: "Steps", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Share your hat" })).toBeVisible();
  await expect(page.getByText(/#doubletakehat/)).toBeVisible();
});
