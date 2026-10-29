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
  await page.getByText("Colours and duplicate stitch").click();
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
  await expect(page.getByText(/31 patches, 1758 squares/)).toBeVisible();
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

/** A plain red PNG, so a pixel under the picture is easy to recognise. */
async function redPng(page: Page): Promise<Buffer> {
  const base64 = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 320;
    c.height = 160;
    const ctx = c.getContext("2d") as CanvasRenderingContext2D;
    ctx.fillStyle = "rgb(255,0,0)";
    ctx.fillRect(0, 0, 320, 160);
    return c.toDataURL("image/png").split(",")[1] as string;
  });
  return Buffer.from(base64, "base64");
}

/** The colour of the grid at a body cell, read from the canvas. */
const cellColour = (page: Page, col: number, row: number) =>
  page.evaluate(
    ({ col, row }) => {
      const canvas = document.querySelector('canvas[aria-label^="Drawing grid"]') as HTMLCanvasElement;
      const dpr = window.devicePixelRatio || 1;
      const cellW = parseFloat(canvas.style.width) / (6 + 112 + 3) ; // approximate; only the colour matters
      void cellW;
      const x = (6 + col * 12 + 6) * dpr;
      const y = (14 + row * (12 / 1.36) + 4) * dpr;
      const d = (canvas.getContext("2d") as CanvasRenderingContext2D).getImageData(x, y, 1, 1).data;
      return [d[0], d[1], d[2]];
    },
    { col, row },
  );

test("a picture can be traced over, and it is kept when the page reloads", async ({ page }) => {
  await startDrawing(page);
  const [r0, g0] = (await cellColour(page, 20, 50)) as number[];
  await page.getByText("Trace over a picture").click();
  await page.locator("#trace-file").setInputFiles({ name: "red.png", mimeType: "image/png", buffer: await redPng(page) });
  await expect(page.getByRole("button", { name: "Remove the picture" })).toBeVisible();
  await expect(page.getByLabel("Show the picture")).toBeChecked();
  // At full strength the picture covers the grid: the cell under it is red
  await page.getByLabel("How strong the picture shows").fill("1");
  await expect.poll(async () => ((await cellColour(page, 20, 50)) as number[]).join(",")).toBe("255,0,0");
  expect([r0, g0]).not.toEqual([255, 0]);
  // Hiding it brings the grid back
  await page.getByLabel("Show the picture").uncheck();
  await expect.poll(async () => ((await cellColour(page, 20, 50)) as number[]).slice(0, 2).join(",")).toBe(`${r0},${g0}`);
  await page.getByLabel("Show the picture").check();
  await page.waitForTimeout(700); // settings are saved a moment after they change

  // Reload: the picture is still there
  await page.reload();
  await page.getByText("Trace over a picture").click();
  await expect(page.getByRole("button", { name: "Remove the picture" })).toBeVisible();
  await expect(page.getByLabel("Show the picture")).toBeChecked();

  await page.getByRole("button", { name: "Remove the picture" }).click();
  await expect(page.getByRole("button", { name: "Remove the picture" })).toHaveCount(0);
  await page.reload();
  await page.getByText("Trace over a picture").click();
  await expect(page.getByRole("button", { name: "Remove the picture" })).toHaveCount(0);
});

test("the picture to trace is never part of the chart or sent anywhere", async ({ page }) => {
  const external: string[] = [];
  page.on("request", (req) => {
    const url = new URL(req.url());
    if (url.protocol.startsWith("http") && url.origin !== "http://localhost:4173") external.push(req.url());
  });
  await startDrawing(page);
  await page.getByText("Trace over a picture").click();
  await page.locator("#trace-file").setInputFiles({ name: "red.png", mimeType: "image/png", buffer: await redPng(page) });
  await expect(page.getByRole("button", { name: "Remove the picture" })).toBeVisible();
  await page.getByRole("link", { name: "Review and start knitting" }).click();
  await expect(page.getByRole("heading", { name: "Review your chart" })).toBeVisible();
  const chartJson = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.includes("draft")).map((k) => localStorage.getItem(k) as string).join(""));
  expect(chartJson.includes("red.png")).toBe(false);
  expect(external).toEqual([]);
});

test("a file that isn’t a picture can’t be used to trace", async ({ page }) => {
  await startDrawing(page);
  await page.getByText("Trace over a picture").click();
  await page.locator("#trace-file").setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("no") });
  await expect(page.getByRole("alert").filter({ hasText: "isn’t a picture" })).toBeVisible();
});

test("zooming the picture out repeats it to fill the whole body", async ({ page }) => {
  await startDrawing(page);
  await page.getByText("Trace over a picture").click();
  // A small red picture: not tall enough to cover the body by itself when zoomed out
  await page.locator("#trace-file").setInputFiles({ name: "red.png", mimeType: "image/png", buffer: await redPng(page) });
  await page.getByLabel("How strong the picture shows").fill("1");
  await page.getByLabel("Zoom the picture").fill("0.3");
  await expect(page.getByText(/repeating the picture/)).toBeVisible();
  // Both ends of the body are covered, not just one copy in the middle
  for (const [col, row] of [[3, 25], [60, 45], [108, 70]] as const) {
    await expect.poll(async () => ((await cellColour(page, col, row)) as number[]).join(",")).toBe("255,0,0");
  }
  await page.getByLabel("Flip every other copy so the edges match").check();
  await expect.poll(async () => ((await cellColour(page, 108, 70)) as number[]).join(",")).toBe("255,0,0");
  await page.waitForTimeout(700);
  await page.reload();
  await page.getByText("Trace over a picture").click();
  await expect(page.getByLabel("Flip every other copy so the edges match")).toBeChecked();
  await expect(page.getByLabel("Zoom the picture")).toHaveValue("0.3");
});
