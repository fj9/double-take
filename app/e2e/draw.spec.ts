import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

async function startDrawing(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Start drawing" }).click();
  await expect(page.getByRole("heading", { name: "Draw your chart" })).toBeVisible();
}

const grid = (page: Page) => page.getByRole("img", { name: /^Drawing grid/ });

/** Click the cell at a column and row counted from the top left of the grid (cells are 12 px wide at the default zoom). */
async function clickCell(page: Page, col: number, row: number) {
  const cellW = 12;
  const cellH = cellW / 1.36;
  await grid(page).click({ position: { x: 6 + col * cellW + cellW / 2, y: 14 + row * cellH + cellH / 2 } });
}

test("draw, fill and undo change the chart and the checks", async ({ page }) => {
  await startDrawing(page);
  await expect(page.getByText("Colour B: 0% of the outside")).toBeVisible();
  await page.getByRole("button", { name: "Fill", exact: true }).click();
  await clickCell(page, 20, 40);
  await expect(page.getByText("Colour B: 100% of the outside")).toBeVisible();
  await page.getByRole("button", { name: "Undo" }).first().click();
  await expect(page.getByText("Colour B: 0% of the outside")).toBeVisible();
  await page.getByRole("button", { name: "Redo" }).click();
  await expect(page.getByText("Colour B: 100% of the outside")).toBeVisible();
});

test("the drawing is saved and the hat reopens in the editor", async ({ page }) => {
  await startDrawing(page);
  await page.getByRole("button", { name: "Fill", exact: true }).click();
  await clickCell(page, 20, 40);
  await expect(page.getByText("Colour B: 100% of the outside")).toBeVisible();
  await page.waitForTimeout(900); // the save waits a moment
  await page.goto("/#/");
  await page.reload();
  await expect(page.getByText("Being designed")).toBeVisible();
  await page.getByRole("button", { name: /^Open My hat/ }).click();
  await expect(page.getByRole("heading", { name: "Draw your chart" })).toBeVisible();
  await expect(page.getByText("Colour B: 100% of the outside")).toBeVisible();
});

test("a duplicate stitch colour can be added and drawn", async ({ page }) => {
  await startDrawing(page);
  await page.getByText("Colours, duplicate stitch and crown").click();
  await page.getByRole("button", { name: "Add a duplicate stitch colour" }).click();
  await expect(page.getByRole("button", { name: "Duplicate: Duplicate colour" })).toHaveAttribute("aria-pressed", "true");
  await clickCell(page, 30, 40);
  await expect(page.getByText(/Duplicate colour duplicate stitch: 1 patch/)).toBeVisible();
  await page.getByRole("link", { name: "Review and start knitting" }).click();
  await expect(page.getByRole("heading", { name: "Review your chart" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Duplicate stitch" })).toBeVisible();
  await expect(page.getByText(/1 patch, 1 squares/)).toBeVisible();
});

test("review, then start knitting from a drawn chart", async ({ page }) => {
  await startDrawing(page);
  await page.getByRole("link", { name: "Review and start knitting" }).click();
  await expect(page.getByRole("heading", { name: "Review your chart" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "How much yarn?" })).toBeVisible();
  await expect(page.getByText("buy more than you think you need")).toBeVisible();
  await page.getByRole("button", { name: "Looks good, start knitting" }).click();
  await expect(page.getByText("Round 1 of 95")).toBeVisible();
  await expect(page.getByRole("link", { name: "Steps" })).toBeVisible();
});

test("the leopard review warns about the amount of duplicate stitch", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Use this chart" }).first().click();
  await expect(page.getByText("Round 1 of 95")).toBeVisible();
  await page.getByRole("link", { name: "More" }).click();
  await page.getByRole("link", { name: "Review the chart" }).click();
  await expect(page.getByRole("heading", { name: "Review your chart" })).toBeVisible();
  await expect(page.getByText(/Duplicate stitch covers 21% of the hat/)).toBeVisible();
  await expect(page.getByText(/39 patches, 2011 squares/)).toBeVisible();
  // Not started yet, so it can be edited, or copied
  await page.getByRole("button", { name: "Make an editable copy" }).click();
  await expect(page.getByRole("heading", { name: "Draw your chart" })).toBeVisible();
});

test("a chart that is already being knitted can’t be edited in place", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Use this chart" }).first().click();
  await page.getByRole("button", { name: /done, next$/ }).click();
  await page.getByRole("link", { name: "More" }).click();
  await page.getByRole("link", { name: "Review the chart" }).click();
  await expect(page.getByText(/its chart is locked/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit this chart" })).toHaveCount(0);
});
